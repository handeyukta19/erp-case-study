const express = require("express");

const {
    createDispatch,
    getDispatches
} = require("../controllers/dispatchController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/auth");

const router = express.Router();

// Only Admin can dispatch
router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN"),
    createDispatch
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getDispatches
);

module.exports = router;