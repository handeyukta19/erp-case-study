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

        if (!quotation_number || !enquiry_id || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Quotation number, enquiry and at least one item are required"
            });
        }

        await client.query("BEGIN");

        // Checkng enquiry exists
        const enquiryResult = await client.query(
            "SELECT id, status FROM enquiries WHERE id = $1",
            [enquiry_id]
        );

        if (enquiryResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Enquiry not found"
            });
        }

        // Creatng quotation
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

            if (!item.product_id || !item.quantity || item.quantity <= 0) {
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


module.exports = {
    createQuotation,
    getQuotations,
    getQuotationById
};