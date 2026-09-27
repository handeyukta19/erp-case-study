require("dotenv").config();
const inventoryRoutes = require("./routes/inventoryRoutes");
const productRoutes = require("./routes/productRoutes");
const dispatchRoutes = require("./routes/dispatchRoutes");
const salesOrderRoutes = require("./routes/salesOrderRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const customerRoutes = require("./routes/customerRoutes");
const {
    authenticateToken,
    authorizeRoles
} = require("./middleware/auth");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const pool = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/sales-orders", salesOrderRoutes);
app.use("/api/dispatches", dispatchRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.get("/", (req, res) => {
    res.json({
        message: "ERP Backend API is running"
    });
});

app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "OK",
            database: "Connected",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "ERROR",
            database: "Not connected"
        });
    }
});

const PORT = process.env.PORT || 5000;
app.get(
    "/api/admin-test",
    authenticateToken,
    authorizeRoles("ADMIN"),
    (req, res) => {
        res.json({
            message: "Welcome Admin! This is a protected ADMIN API.",
            user: req.user
        });
    }
);


app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});