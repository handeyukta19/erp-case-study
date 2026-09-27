const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Access token required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "You do not have permission to perform this action"
            });
        }

        next();
    };
};

const confirmSalesOrder = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query("BEGIN");

        // 1. Get the sales order
        const orderResult = await client.query(
            `SELECT *
             FROM sales_orders
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Sales order not found"
            });
        }

        const order = orderResult.rows[0];

        // 2. Check current status
        if (order.status !== "PENDING") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: `Sales order is already ${order.status}`
            });
        }

        // 3. Get order items
        const itemsResult = await client.query(
            `SELECT
                soi.product_id,
                soi.quantity,
                p.product_name
             FROM sales_order_items soi
             JOIN products p ON p.id = soi.product_id
             WHERE soi.sales_order_id = $1`,
            [id]
        );

        if (itemsResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Sales order has no items"
            });
        }

        const reservedItems = [];

        // 4. Check and reserve inventory
        for (const item of itemsResult.rows) {

            const inventoryResult = await client.query(
                `SELECT
                    product_id,
                    physical_quantity,
                    reserved_quantity
                 FROM inventory
                 WHERE product_id = $1
                 FOR UPDATE`,
                [item.product_id]
            );

            if (inventoryResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: `Inventory not found for ${item.product_name}`
                });
            }

            const inventory = inventoryResult.rows[0];

            const physical = Number(inventory.physical_quantity);
            const reserved = Number(inventory.reserved_quantity);
            const available = physical - reserved;
            const requested = Number(item.quantity);

            // 5. Insufficient stock check
            if (requested > available) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: `Insufficient stock for ${item.product_name}`,
                    available_quantity: available,
                    requested_quantity: requested
                });
            }

            // 6. Reserve stock
            await client.query(
                `UPDATE inventory
                 SET reserved_quantity = reserved_quantity + $1
                 WHERE product_id = $2`,
                [requested, item.product_id]
            );

            reservedItems.push({
                product_id: item.product_id,
                product_name: item.product_name,
                reserved_quantity: requested,
                remaining_available: available - requested
            });
        }

        // 7. Confirm Sales Order
        const updatedOrder = await client.query(
            `UPDATE sales_orders
             SET status = 'CONFIRMED'
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        await client.query("COMMIT");

        res.json({
            message: "Sales order confirmed and inventory reserved successfully",
            sales_order: updatedOrder.rows[0],
            inventory_reservation: reservedItems
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Confirm sales order error:", error);

        res.status(500).json({
            message: "Server error"
        });

    } finally {
        client.release();
    }
};

module.exports = {
    authenticateToken,
    authorizeRoles
};