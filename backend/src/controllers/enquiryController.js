const pool = require("../config/db");

const createEnquiry = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            customer_id,
            enquiry_number,
            enquiry_date,
            required_date,
            notes,
            items
        } = req.body;

        // Basic validation
        if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Customer and at least one product are required"
            });
        }

        await client.query("BEGIN");

        // Check customer exists
        const customerResult = await client.query(
            "SELECT id FROM customers WHERE id = $1",
            [customer_id]
        );

        if (customerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Customer not found"
            });
        }

        // Creatng  enquiry
        const enquiryResult = await client.query(
            `INSERT INTO enquiries
            (enquiry_number, customer_id, enquiry_date, required_date, notes, created_by)
            VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6)
            RETURNING *`,
            [
                enquiry_number,
                customer_id,
                enquiry_date || null,
                required_date || null,
                notes || null,
                req.user.id
            ]
        );

        const enquiry = enquiryResult.rows[0];

        // Insertng enquiry products
        for (const item of items) {

            if (!item.product_id || !item.quantity || item.quantity <= 0) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Each item must have a valid product_id and positive quantity"
                });
            }

            // Checkng product exists
            const productResult = await client.query(
                "SELECT id FROM products WHERE id = $1",
                [item.product_id]
            );

            if (productResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: `Product ${item.product_id} not found`
                });
            }

            await client.query(
                `INSERT INTO enquiry_items
                (enquiry_id, product_id, quantity)
                VALUES ($1, $2, $3)`,
                [
                    enquiry.id,
                    item.product_id,
                    item.quantity
                ]
            );
        }

        await client.query("COMMIT");

        // Returng complete enquiry
        const result = await pool.query(
            `SELECT
                e.id,
                e.enquiry_number,
                e.enquiry_date,
                e.required_date,
                e.notes,
                e.status,
                c.company_name,
                c.contact_person
             FROM enquiries e
             JOIN customers c ON c.id = e.customer_id
             WHERE e.id = $1`,
            [enquiry.id]
        );

        res.status(201).json({
            message: "Enquiry created successfully",
            enquiry: result.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Create enquiry error:", error);

        res.status(500).json({
            message: "Server error"
        });

    } finally {
        client.release();
    }
};


const getEnquiries = async (req, res) => {
    try {

        const result = await pool.query(
            `SELECT
                e.id,
                e.enquiry_number,
                e.enquiry_date,
                e.required_date,
                e.status,
                c.company_name,
                c.contact_person
             FROM enquiries e
             JOIN customers c ON c.id = e.customer_id
             ORDER BY e.id DESC`
        );

        res.json({
            enquiries: result.rows
        });

    } catch (error) {

        console.error("Get enquiries error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


const getEnquiryById = async (req, res) => {
    try {

        const { id } = req.params;

        const enquiryResult = await pool.query(
            `SELECT
                e.*,
                c.company_name,
                c.contact_person,
                c.mobile,
                c.email,
                c.city
             FROM enquiries e
             JOIN customers c ON c.id = e.customer_id
             WHERE e.id = $1`,
            [id]
        );

        if (enquiryResult.rows.length === 0) {
            return res.status(404).json({
                message: "Enquiry not found"
            });
        }

        const itemsResult = await pool.query(
            `SELECT
                ei.id,
                ei.product_id,
                p.product_code,
                p.product_name,
                p.category,
                p.unit,
                ei.quantity
             FROM enquiry_items ei
             JOIN products p ON p.id = ei.product_id
             WHERE ei.enquiry_id = $1
             ORDER BY ei.id`,
            [id]
        );

        res.json({
            enquiry: enquiryResult.rows[0],
            items: itemsResult.rows
        });

    } catch (error) {

        console.error("Get enquiry error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


module.exports = {
    createEnquiry,
    getEnquiries,
    getEnquiryById
};