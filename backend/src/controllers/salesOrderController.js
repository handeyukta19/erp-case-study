const pool = require("../config/db");

const createSalesOrder = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            order_number,
            quotation_id
        } = req.body;

        if (!order_number || !quotation_id) {
            return res.status(400).json({
                message: "Order number and quotation ID are required"
            });
        }

        await client.query("BEGIN");

        const quotationResult = await client.query(
            `SELECT
                q.id,
                q.status,
                q.enquiry_id,
                e.customer_id,
                q.*
             FROM quotations q
             JOIN enquiries e ON e.id = q.enquiry_id
             WHERE q.id = $1`,
            [quotation_id]
        );

        if (quotationResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Quotation not found"
            });
        }

        const quotation = quotationResult.rows[0];

    
        if (quotation.status !== "ACCEPTED") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Only ACCEPTED quotations can be converted to sales orders"
            });
        }

        
        const itemsResult = await client.query(
            `SELECT
                quotation_id,
                product_id,
                quantity,
                unit_price
             FROM quotation_items
             WHERE quotation_id = $1
             ORDER BY id`,
            [quotation_id]
        );

        if (itemsResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Quotation has no items"
            });
        }

      
        let totalAmount = 0;

        for (const item of itemsResult.rows) {
            totalAmount +=
                Number(item.quantity) * Number(item.unit_price);
        }

        const orderResult = await client.query(
            `INSERT INTO sales_orders
            (
                order_number,
                quotation_id,
                customer_id,
                total_amount,
                status
            )
            VALUES ($1, $2, $3, $4, 'PENDING')
            RETURNING *`,
            [
                order_number,
                quotation_id,
                quotation.customer_id,
                totalAmount
            ]
        );

        const order = orderResult.rows[0];

        const savedItems = [];

        for (const item of itemsResult.rows) {

            const itemResult = await client.query(
                `INSERT INTO sales_order_items
                (
                    sales_order_id,
                    product_id,
                    quantity,
                    unit_price
                )
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [
                    order.id,
                    item.product_id,
                    item.quantity,
                    item.unit_price
                ]
            );

            savedItems.push(itemResult.rows[0]);
        }

        await client.query("COMMIT");

        res.status(201).json({
            message: "Sales order created successfully",
            sales_order: {
                ...order,
                total_amount: Number(totalAmount.toFixed(2)),
                items: savedItems
            }
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Create sales order error:", error);

        res.status(500).json({
            message: "Server error"
        });

    } finally {
        client.release();
    }
};


const getSalesOrders = async (req, res) => {
    try {

        const result = await pool.query(
            `SELECT
                so.id,
                so.order_number,
                so.quotation_id,
                so.customer_id,
                so.order_date,
                so.total_amount,
                so.status,
                c.company_name
             FROM sales_orders so
             JOIN customers c ON c.id = so.customer_id
             ORDER BY so.id DESC`
        );

        res.json({
            sales_orders: result.rows
        });

    } catch (error) {

        console.error("Get sales orders error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


const getSalesOrderById = async (req, res) => {
    try {

        const { id } = req.params;

        const orderResult = await pool.query(
            `SELECT
                so.*,
                c.company_name,
                c.contact_person,
                c.mobile,
                c.email,
                q.quotation_number
             FROM sales_orders so
             JOIN customers c ON c.id = so.customer_id
             JOIN quotations q ON q.id = so.quotation_id
             WHERE so.id = $1`,
            [id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                message: "Sales order not found"
            });
        }

        const itemsResult = await pool.query(
            `SELECT
                soi.id,
                soi.product_id,
                p.product_code,
                p.product_name,
                soi.quantity,
                soi.unit_price
             FROM sales_order_items soi
             JOIN products p ON p.id = soi.product_id
             WHERE soi.sales_order_id = $1
             ORDER BY soi.id`,
            [id]
        );

        res.json({
            sales_order: orderResult.rows[0],
            items: itemsResult.rows
        });

    } catch (error) {

        console.error("Get sales order error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
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
    createSalesOrder,
    getSalesOrders,
    getSalesOrderById,
    confirmSalesOrder
};