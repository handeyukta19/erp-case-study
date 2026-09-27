const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

// GET inventory
router.get("/", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                i.product_id,
                p.product_code,
                p.product_name,
                p.category,
                p.unit,
                i.physical_quantity,
                i.reserved_quantity,
                (i.physical_quantity - i.reserved_quantity) AS available_quantity
            FROM inventory i
            JOIN products p
                ON p.id = i.product_id
            ORDER BY i.product_id
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Get inventory error:", error);

        res.status(500).json({
            message: "Failed to fetch inventory"
        });
    }
});

module.exports = router;