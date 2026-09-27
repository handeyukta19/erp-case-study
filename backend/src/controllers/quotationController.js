const pool = require("../config/db");

const createQuotation = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            quotation_number,
            enquiry_id,
            valid_until,
            items
        } = req.body;

        if (
            !quotation_number ||
            !enquiry_id ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                message: "Quotation number, enquiry and at least one item are required"
            });
        }

        await client.query("BEGIN");

        const enquiryResult = await client.query(
            `SELECT id, status
             FROM enquiries
             WHERE id = $1
             FOR UPDATE`,
            [enquiry_id]
        );

        if (enquiryResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Enquiry not found"
            });
        }

        const enquiry = enquiryResult.rows[0];

        if (enquiry.status !== "NEW") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: `Quotation cannot be created for an enquiry with status ${enquiry.status}`
            });
        }

        const quotationResult = await client.query(
            `INSERT INTO quotations
            (quotation_number, enquiry_id, valid_until, status)
            VALUES ($1, $2, $3, 'DRAFT')
            RETURNING *`,
            [
                quotation_number,
                enquiry_id,
                valid_until || null
            ]
        );

        const quotation = quotationResult.rows[0];

        let subtotal = 0;
        let totalDiscount = 0;
        let totalGST = 0;

        const savedItems = [];

        for (const item of items) {
            if (
                !item.product_id ||
                !item.quantity ||
                Number(item.quantity) <= 0
            ) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Each item must have a valid product_id and positive quantity"
                });
            }

            const productResult = await client.query(
                `SELECT id, product_name, base_price
                 FROM products
                 WHERE id = $1`,
                [item.product_id]
            );

            if (productResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: `Product ${item.product_id} not found`
                });
            }

            const product = productResult.rows[0];

            const quantity = Number(item.quantity);
            const unitPrice = Number(product.base_price);
            const discountPercent = Number(item.discount_percent || 0);
            const gstPercent = Number(item.gst_percent || 0);

            if (
                discountPercent < 0 ||
                discountPercent > 100 ||
                gstPercent < 0 ||
                gstPercent > 100
            ) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Invalid discount or GST percentage"
                });
            }

            const lineSubtotal = quantity * unitPrice;

            const discountAmount =
                lineSubtotal * discountPercent / 100;

            const taxableAmount =
                lineSubtotal - discountAmount;

            const gstAmount =
                taxableAmount * gstPercent / 100;

            const lineTotal =
                taxableAmount + gstAmount;

            subtotal += lineSubtotal;
            totalDiscount += discountAmount;
            totalGST += gstAmount;

            const itemResult = await client.query(
                `INSERT INTO quotation_items
                (
                    quotation_id,
                    product_id,
                    quantity,
                    unit_price,
                    discount_percent,
                    gst_percent
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`,
                [
                    quotation.id,
                    product.id,
                    quantity,
                    unitPrice,
                    discountPercent,
                    gstPercent
                ]
            );

            savedItems.push({
                ...itemResult.rows[0],
                product_name: product.product_name,
                line_subtotal: Number(lineSubtotal.toFixed(2)),
                discount_amount: Number(discountAmount.toFixed(2)),
                taxable_amount: Number(taxableAmount.toFixed(2)),
                gst_amount: Number(gstAmount.toFixed(2)),
                line_total: Number(lineTotal.toFixed(2))
            });
        }

        const grandTotal =
            subtotal - totalDiscount + totalGST;

        await client.query("COMMIT");

        res.status(201).json({
            message: "Quotation created successfully",
            quotation: {
                ...quotation,
                subtotal: Number(subtotal.toFixed(2)),
                total_discount: Number(totalDiscount.toFixed(2)),
                total_gst: Number(totalGST.toFixed(2)),
                grand_total: Number(grandTotal.toFixed(2)),
                items: savedItems
            }
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Create quotation error:", error);

        res.status(500).json({
            message: "Server error"
        });
    } finally {
        client.release();
    }
};


const getQuotations = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                q.id,
                q.quotation_number,
                q.enquiry_id,
                q.quotation_date,
                q.valid_until,
                q.status,
                e.customer_id,
                e.enquiry_number,
                c.company_name
             FROM quotations q
             JOIN enquiries e ON e.id = q.enquiry_id
             JOIN customers c ON c.id = e.customer_id
             ORDER BY q.id DESC`
        );

        res.json({
            quotations: result.rows
        });

    } catch (error) {
        console.error("Get quotations error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


const getQuotationById = async (req, res) => {
    try {
        const { id } = req.params;

        const quotationResult = await pool.query(
            `SELECT
                q.*,
                e.enquiry_number,
                e.customer_id,
                c.company_name,
                c.contact_person,
                c.mobile,
                c.email
             FROM quotations q
             JOIN enquiries e ON e.id = q.enquiry_id
             JOIN customers c ON c.id = e.customer_id
             WHERE q.id = $1`,
            [id]
        );

        if (quotationResult.rows.length === 0) {
            return res.status(404).json({
                message: "Quotation not found"
            });
        }

        const itemsResult = await pool.query(
            `SELECT
                qi.id,
                qi.product_id,
                p.product_code,
                p.product_name,
                qi.quantity,
                qi.unit_price,
                qi.discount_percent,
                qi.gst_percent
             FROM quotation_items qi
             JOIN products p ON p.id = qi.product_id
             WHERE qi.quotation_id = $1
             ORDER BY qi.id`,
            [id]
        );

        let subtotal = 0;
        let totalDiscount = 0;
        let totalGST = 0;

        const items = itemsResult.rows.map(item => {
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unit_price);
            const discountPercent = Number(item.discount_percent);
            const gstPercent = Number(item.gst_percent);

            const lineSubtotal = quantity * unitPrice;

            const discountAmount =
                lineSubtotal * discountPercent / 100;

            const taxableAmount =
                lineSubtotal - discountAmount;

            const gstAmount =
                taxableAmount * gstPercent / 100;

            const lineTotal =
                taxableAmount + gstAmount;

            subtotal += lineSubtotal;
            totalDiscount += discountAmount;
            totalGST += gstAmount;

            return {
                ...item,
                line_subtotal: Number(lineSubtotal.toFixed(2)),
                discount_amount: Number(discountAmount.toFixed(2)),
                taxable_amount: Number(taxableAmount.toFixed(2)),
                gst_amount: Number(gstAmount.toFixed(2)),
                line_total: Number(lineTotal.toFixed(2))
            };
        });

        const grandTotal =
            subtotal - totalDiscount + totalGST;

        res.json({
            quotation: quotationResult.rows[0],
            items,
            summary: {
                subtotal: Number(subtotal.toFixed(2)),
                total_discount: Number(totalDiscount.toFixed(2)),
                total_gst: Number(totalGST.toFixed(2)),
                grand_total: Number(grandTotal.toFixed(2))
            }
        });

    } catch (error) {
        console.error("Get quotation error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// Update quotation status
const updateQuotationStatus = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            "SENT",
            "ACCEPTED",
            "REJECTED"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid quotation status"
            });
        }

        await client.query("BEGIN");

        const quotationResult = await client.query(
            `SELECT id, status, enquiry_id
             FROM quotations
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (quotationResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Quotation not found"
            });
        }

        const quotation = quotationResult.rows[0];

        if (quotation.status === "DRAFT" && status !== "SENT") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Draft quotation must be sent before it can be accepted or rejected"
            });
        }

        if (
            quotation.status === "SENT" &&
            !["ACCEPTED", "REJECTED"].includes(status)
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Sent quotation can only be accepted or rejected"
            });
        }

        if (
            ["ACCEPTED", "REJECTED"].includes(quotation.status)
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: `Quotation is already ${quotation.status}`
            });
        }

        const updatedQuotation = await client.query(
            `UPDATE quotations
             SET status = $1
             WHERE id = $2
             RETURNING *`,
            [status, id]
        );

        if (status === "SENT") {
            await client.query(
                `UPDATE enquiries
                 SET status = 'QUOTED'
                 WHERE id = $1`,
                [quotation.enquiry_id]
            );
        }

        if (status === "ACCEPTED") {
            await client.query(
                `UPDATE enquiries
                 SET status = 'WON'
                 WHERE id = $1`,
                [quotation.enquiry_id]
            );
        }

        if (status === "REJECTED") {
            await client.query(
                `UPDATE enquiries
                 SET status = 'LOST'
                 WHERE id = $1`,
                [quotation.enquiry_id]
            );
        }

        await client.query("COMMIT");

        res.json({
            message: `Quotation marked ${status}`,
            quotation: updatedQuotation.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Update quotation status error:", error);

        res.status(500).json({
            message: "Server error"
        });
    } finally {
        client.release();
    }
};


// Convert accepted quotation
const convertQuotationToSalesOrder = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query("BEGIN");

        const quotationResult = await client.query(
            `SELECT
                q.*,
                e.customer_id
             FROM quotations q
             JOIN enquiries e ON e.id = q.enquiry_id
             WHERE q.id = $1
             FOR UPDATE`,
            [id]
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

        const existingOrder = await client.query(
            `SELECT id, order_number
             FROM sales_orders
             WHERE quotation_id = $1`,
            [id]
        );

        if (existingOrder.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                message: "This quotation has already been converted to a Sales Order",
                sales_order: existingOrder.rows[0]
            });
        }

        const itemsResult = await client.query(
            `SELECT
                product_id,
                quantity,
                unit_price,
                discount_percent,
                gst_percent
             FROM quotation_items
             WHERE quotation_id = $1
             ORDER BY id`,
            [id]
        );

        if (itemsResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Quotation has no items"
            });
        }

        let subtotal = 0;
        let totalDiscount = 0;
        let totalGST = 0;

        for (const item of itemsResult.rows) {
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unit_price);
            const discountPercent = Number(item.discount_percent || 0);
            const gstPercent = Number(item.gst_percent || 0);

            const lineSubtotal = quantity * unitPrice;

            const discount =
                lineSubtotal * discountPercent / 100;

            const taxable =
                lineSubtotal - discount;

            const gst =
                taxable * gstPercent / 100;

            subtotal += lineSubtotal;
            totalDiscount += discount;
            totalGST += gst;
        }

        const totalAmount =
            subtotal - totalDiscount + totalGST;

        const orderNumber = `SO-${Date.now()}`;

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
                orderNumber,
                id,
                quotation.customer_id,
                Number(totalAmount.toFixed(2))
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

        if (error.code === "23505") {
            return res.status(409).json({
                message: "This quotation has already been converted to a Sales Order"
            });
        }

        console.error("Convert quotation error:", error);

        res.status(500).json({
            message: "Server error"
        });
    } finally {
        client.release();
    }
};


module.exports = {
    createQuotation,
    getQuotations,
    getQuotationById,
    updateQuotationStatus,
    convertQuotationToSalesOrder
};