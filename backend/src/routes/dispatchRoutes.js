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

router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    createDispatch
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getDispatches
);

module.exports = router;