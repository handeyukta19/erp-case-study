const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

// GET all products
router.get("/", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                product_code,
                product_name,
                category,
                unit,
                base_price,
                created_at
            FROM products
            ORDER BY id
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Get products error:", error);

        res.status(500).json({
            message: "Failed to fetch products"
        });
    }
});

module.exports = router;