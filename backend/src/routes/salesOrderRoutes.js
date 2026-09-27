const express = require("express");

const {
    createSalesOrder,
    getSalesOrders,
    getSalesOrderById,
    confirmSalesOrder
} = require("../controllers/salesOrderController");

const {
    createDispatch
} = require("../controllers/dispatchController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/auth");

const router = express.Router();

router.post(
    "/",
    authenticateToken,
    authorizeRoles("SALES_USER", "ADMIN"),
    createSalesOrder
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getSalesOrders
);

router.get(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getSalesOrderById
);

// Admin stock reservation (supports both POST per PDF spec and PUT)
router.post(
    "/:id/confirm",
    authenticateToken,
    authorizeRoles("ADMIN"),
    confirmSalesOrder
);

router.put(
    "/:id/confirm",
    authenticateToken,
    authorizeRoles("ADMIN"),
    confirmSalesOrder
);

// Admin dispatch (per PDF spec: POST /sales-orders/:id/dispatch)
router.post(
    "/:id/dispatch",
    authenticateToken,
    authorizeRoles("ADMIN"),
    createDispatch
);

module.exports = router;