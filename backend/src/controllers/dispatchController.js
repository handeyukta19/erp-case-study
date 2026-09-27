const pool = require("../config/db");

const createDispatch = async (req, res) => {
    const client = await pool.connect();

    try {
        const sales_order_id = req.params.id || req.body.sales_order_id;
        const dispatch_number = req.body.dispatch_number || `DSP-${Date.now()}`;
        const { vehicle_number, driver_name } = req.body;

        if (
            !sales_order_id ||
            !vehicle_number ||
            !driver_name
        ) {
            return res.status(400).json({
                message:
                    "Sales order ID, vehicle number and driver name are required"
            });
        }

        await client.query("BEGIN");

        // 1. Get Sales Order
        const orderResult = await client.query(
            `SELECT *
             FROM sales_orders
             WHERE id = $1
             FOR UPDATE`,
            [sales_order_id]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Sales order not found"
            });
        }

        const order = orderResult.rows[0];

        // 2. Sales Order must be CONFIRMED
        if (order.status !== "CONFIRMED") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    `Only CONFIRMED sales orders can be dispatched. Current status: ${order.status}`
            });
        }

        // 3. Get Sales Order Items
        const itemsResult = await client.query(
            `SELECT
                soi.product_id,
                soi.quantity,
                p.product_name
             FROM sales_order_items soi
             JOIN products p
               ON p.id = soi.product_id
             WHERE soi.sales_order_id = $1
             ORDER BY soi.id`,
            [sales_order_id]
        );

        if (itemsResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Sales order has no items"
            });
        }

        // 4. Creatng Dispatch
        const dispatchResult = await client.query(
            `INSERT INTO dispatches
            (
                dispatch_number,
                sales_order_id,
                vehicle_number,
                driver_name
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [
                dispatch_number,
                sales_order_id,
                vehicle_number,
                driver_name
            ]
        );

        const dispatch = dispatchResult.rows[0];

        const dispatchedItems = [];

        // 5. Creatng Dispatch Items
        // 6. Reducng physical and reserved inventory
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
                    message:
                        `Inventory not found for ${item.product_name}`
                });
            }

            const inventory = inventoryResult.rows[0];

            const physical = Number(inventory.physical_quantity);
            const reserved = Number(inventory.reserved_quantity);
            const quantity = Number(item.quantity);

            
            if (quantity > reserved) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message:
                        `Reserved stock is insufficient for ${item.product_name}`,
                    reserved_quantity: reserved,
                    dispatch_quantity: quantity
                });
            }

            
            if (quantity > physical) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message:
                        `Physical stock is insufficient for ${item.product_name}`,
                    physical_quantity: physical,
                    dispatch_quantity: quantity
                });
            }

            // Creating dispatch item
            const dispatchItemResult = await client.query(
                `INSERT INTO dispatch_items
                (
                    dispatch_id,
                    product_id,
                    quantity
                )
                VALUES ($1, $2, $3)
                RETURNING *`,
                [
                    dispatch.id,
                    item.product_id,
                    quantity
                ]
            );

        
            await client.query(
                `UPDATE inventory
                 SET
                    physical_quantity = physical_quantity - $1,
                    reserved_quantity = reserved_quantity - $1
                 WHERE product_id = $2`,
                [
                    quantity,
                    item.product_id
                ]
            );

            dispatchedItems.push({
                ...dispatchItemResult.rows[0],
                product_name: item.product_name
            });
        }

        // 7. Updatng Sales Order status
        const updatedOrder = await client.query(
            `UPDATE sales_orders
             SET status = 'DISPATCHED'
             WHERE id = $1
             RETURNING *`,
            [sales_order_id]
        );

        await client.query("COMMIT");

        res.status(201).json({
            message: "Dispatch created successfully",
            dispatch,
            sales_order: updatedOrder.rows[0],
            items: dispatchedItems
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Create dispatch error:", error);

        res.status(500).json({
            message: "Server error"
        });

    } finally {
        client.release();
    }
};


const getDispatches = async (req, res) => {
    try {

        const result = await pool.query(
            `SELECT
                d.id,
                d.dispatch_number,
                d.sales_order_id,
                d.dispatch_date,
                d.vehicle_number,
                d.driver_name,
                so.order_number
             FROM dispatches d
             JOIN sales_orders so
               ON so.id = d.sales_order_id
             ORDER BY d.id DESC`
        );

        res.json({
            dispatches: result.rows
        });

    } catch (error) {

        console.error("Get dispatches error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


module.exports = {
    createDispatch,
    getDispatches
};