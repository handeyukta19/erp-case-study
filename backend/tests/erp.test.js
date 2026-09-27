const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const app = require("../src/server");
const pool = require("../src/config/db");

let server;
let baseUrl;
let adminToken;
let salesToken;

// Helper to make HTTP requests against local server instance
async function request(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers = {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {})
    };

    const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { message: text };
    }

    return { status: res.status, data };
}

describe("ERP System Technical Case Study Automated Tests", () => {
    before(async () => {
        // 1. Reset database with schema and seed
        const schema = fs.readFileSync(path.join(__dirname, "../../database/schema.sql"), "utf8");
        const seed = fs.readFileSync(path.join(__dirname, "../../database/seed.sql"), "utf8");
        await pool.query(schema);
        await pool.query(seed);

        // 2. Start test HTTP server on free port
        await new Promise((resolve) => {
            server = http.createServer(app).listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}/api`;
                resolve();
            });
        });

        // 3. Authenticate Admin
        const adminRes = await request("/auth/login", {
            method: "POST",
            body: { email: "admin@erp.com", password: "Admin@123" }
        });
        assert.equal(adminRes.status, 200, "Admin login failed");
        adminToken = adminRes.data.token;

        // 4. Authenticate Sales User
        const salesRes = await request("/auth/login", {
            method: "POST",
            body: { email: "sales@erp.com", password: "Sales@123" }
        });
        assert.equal(salesRes.status, 200, "Sales login failed");
        salesToken = salesRes.data.token;
    });

    after(async () => {
        if (server) server.close();
        await pool.end();
    });

    // -------------------------------------------------------------
    // TEST 1: Quotation total calculated correctly
    // -------------------------------------------------------------
    test("1. Quotation total is calculated correctly on backend", async () => {
        // Create enquiry
        const enquiryRes = await request("/enquiries", {
            method: "POST",
            token: salesToken,
            body: {
                enquiry_number: `TEST-ENQ-01`,
                customer_id: 1,
                items: [{ product_id: 1, quantity: 2 }] // Product 1 base_price = 45000.00
            }
        });
        assert.equal(enquiryRes.status, 201, "Enquiry creation failed");
        const enquiryId = enquiryRes.data.enquiry.id;

        // Create quotation: Quantity = 2, Unit Price = 45000, Discount = 10%, GST = 18%
        // Subtotal = 2 * 45000 = 90000
        // Discount (10%) = 9000
        // Taxable = 81000
        // GST (18%) = 14580
        // Grand Total = 95580
        const quotationRes = await request("/quotations", {
            method: "POST",
            token: salesToken,
            body: {
                quotation_number: `TEST-QUO-01`,
                enquiry_id: enquiryId,
                items: [
                    {
                        product_id: 1,
                        quantity: 2,
                        discount_percent: 10,
                        gst_percent: 18
                    }
                ]
            }
        });

        assert.equal(quotationRes.status, 201, "Quotation creation failed");
        const q = quotationRes.data.quotation;

        assert.equal(Number(q.subtotal), 90000);
        assert.equal(Number(q.total_discount), 9000);
        assert.equal(Number(q.total_gst), 14580);
        assert.equal(Number(q.grand_total), 95580);
    });

    // -------------------------------------------------------------
    // TEST 2: Rejected / Draft quotation cannot create a Sales Order
    // -------------------------------------------------------------
    test("2. Rejected or Draft quotation cannot create a Sales Order", async () => {
        // Create enquiry & quotation in DRAFT state
        const enquiryRes = await request("/enquiries", {
            method: "POST",
            token: salesToken,
            body: {
                enquiry_number: `TEST-ENQ-02`,
                customer_id: 1,
                items: [{ product_id: 2, quantity: 5 }]
            }
        });
        const enquiryId = enquiryRes.data.enquiry.id;

        const draftQuotationRes = await request("/quotations", {
            method: "POST",
            token: salesToken,
            body: {
                quotation_number: `TEST-QUO-DRAFT`,
                enquiry_id: enquiryId,
                items: [{ product_id: 2, quantity: 5, discount_percent: 0, gst_percent: 18 }]
            }
        });
        const quotationId = draftQuotationRes.data.quotation.id;

        // Try converting DRAFT quotation -> should fail
        const convertDraftRes = await request(`/quotations/${quotationId}/convert`, {
            method: "POST",
            token: salesToken
        });
        assert.equal(convertDraftRes.status, 400, "Draft quotation conversion should fail");

        // Mark quotation SENT then REJECTED
        await request(`/quotations/${quotationId}/status`, {
            method: "PATCH",
            token: salesToken,
            body: { status: "SENT" }
        });
        await request(`/quotations/${quotationId}/status`, {
            method: "PATCH",
            token: salesToken,
            body: { status: "REJECTED" }
        });

        // Try converting REJECTED quotation -> should fail
        const convertRejectedRes = await request(`/quotations/${quotationId}/convert`, {
            method: "POST",
            token: salesToken
        });
        assert.equal(convertRejectedRes.status, 400, "Rejected quotation conversion should fail");
    });

    // -------------------------------------------------------------
    // TEST 3: Same quotation cannot generate duplicate Sales Orders
    // -------------------------------------------------------------
    test("3. Same quotation cannot generate duplicate Sales Orders", async () => {
        // Create enquiry & quotation
        const enquiryRes = await request("/enquiries", {
            method: "POST",
            token: salesToken,
            body: {
                enquiry_number: `TEST-ENQ-03`,
                customer_id: 1,
                items: [{ product_id: 3, quantity: 2 }]
            }
        });
        const enquiryId = enquiryRes.data.enquiry.id;

        const quoRes = await request("/quotations", {
            method: "POST",
            token: salesToken,
            body: {
                quotation_number: `TEST-QUO-DUP`,
                enquiry_id: enquiryId,
                items: [{ product_id: 3, quantity: 2, discount_percent: 0, gst_percent: 18 }]
            }
        });
        const quotationId = quoRes.data.quotation.id;

        // Send and Accept quotation
        await request(`/quotations/${quotationId}/status`, {
            method: "PATCH",
            token: salesToken,
            body: { status: "SENT" }
        });
        await request(`/quotations/${quotationId}/status`, {
            method: "PATCH",
            token: salesToken,
            body: { status: "ACCEPTED" }
        });

        // First Conversion -> SUCCESS
        const firstConvert = await request(`/quotations/${quotationId}/convert`, {
            method: "POST",
            token: salesToken
        });
        assert.equal(firstConvert.status, 201, "First conversion should succeed");

        // Second Conversion -> DUPLICATE CONFLICT (409)
        const secondConvert = await request(`/quotations/${quotationId}/convert`, {
            method: "POST",
            token: salesToken
        });
        assert.equal(secondConvert.status, 409, "Duplicate conversion must fail with 409 conflict");
    });

    // -------------------------------------------------------------
    // TEST 4: Cannot reserve more than available inventory
    // -------------------------------------------------------------
    test("4. Cannot reserve more than available inventory", async () => {
        // Product 3 has physical=95, reserved=0, available=95
        // Create enquiry for 200 units (exceeds 95 available)
        const enquiryRes = await request("/enquiries", {
            method: "POST",
            token: salesToken,
            body: {
                enquiry_number: `TEST-ENQ-04`,
                customer_id: 1,
                items: [{ product_id: 3, quantity: 200 }]
            }
        });
        const enquiryId = enquiryRes.data.enquiry.id;

        const quoRes = await request("/quotations", {
            method: "POST",
            token: salesToken,
            body: {
                quotation_number: `TEST-QUO-OVER`,
                enquiry_id: enquiryId,
                items: [{ product_id: 3, quantity: 200, discount_percent: 0, gst_percent: 18 }]
            }
        });
        const quotationId = quoRes.data.quotation.id;

        await request(`/quotations/${quotationId}/status`, { method: "PATCH", token: salesToken, body: { status: "SENT" } });
        await request(`/quotations/${quotationId}/status`, { method: "PATCH", token: salesToken, body: { status: "ACCEPTED" } });

        const convertRes = await request(`/quotations/${quotationId}/convert`, { method: "POST", token: salesToken });
        const salesOrderId = convertRes.data.sales_order.id;

        // Admin attempts to confirm/reserve 200 units when only 95 are available -> MUST FAIL
        const confirmRes = await request(`/sales-orders/${salesOrderId}/confirm`, {
            method: "POST",
            token: adminToken
        });

        assert.equal(confirmRes.status, 400, "Confirmation beyond available inventory must fail");
        assert.match(confirmRes.data.message, /Insufficient stock/i);
    });

    // -------------------------------------------------------------
    // TEST 5: Unauthorized user cannot perform restricted operation
    // -------------------------------------------------------------
    test("5. Unauthorized user (SALES_USER) cannot perform ADMIN restricted operations", async () => {
        // Create an order to test confirmation with sales user token
        const enquiryRes = await request("/enquiries", {
            method: "POST",
            token: salesToken,
            body: {
                enquiry_number: `TEST-ENQ-05`,
                customer_id: 1,
                items: [{ product_id: 5, quantity: 10 }]
            }
        });
        const enquiryId = enquiryRes.data.enquiry.id;

        const quoRes = await request("/quotations", {
            method: "POST",
            token: salesToken,
            body: {
                quotation_number: `TEST-QUO-AUTH`,
                enquiry_id: enquiryId,
                items: [{ product_id: 5, quantity: 10 }]
            }
        });
        const quotationId = quoRes.data.quotation.id;

        await request(`/quotations/${quotationId}/status`, { method: "PATCH", token: salesToken, body: { status: "SENT" } });
        await request(`/quotations/${quotationId}/status`, { method: "PATCH", token: salesToken, body: { status: "ACCEPTED" } });

        const convertRes = await request(`/quotations/${quotationId}/convert`, { method: "POST", token: salesToken });
        const salesOrderId = convertRes.data.sales_order.id;

        // SALES_USER attempts Admin operation: confirm sales order
        const unauthorizedConfirm = await request(`/sales-orders/${salesOrderId}/confirm`, {
            method: "POST",
            token: salesToken
        });
        assert.equal(unauthorizedConfirm.status, 403, "Sales user must receive 403 Forbidden for confirm");

        // SALES_USER attempts Admin operation: dispatch sales order
        const unauthorizedDispatch = await request(`/sales-orders/${salesOrderId}/dispatch`, {
            method: "POST",
            token: salesToken,
            body: { vehicle_number: "MH-12-AB-1234", driver_name: "John" }
        });
        assert.equal(unauthorizedDispatch.status, 403, "Sales user must receive 403 Forbidden for dispatch");
    });

    // -------------------------------------------------------------
    // TEST 6 (Bonus): Simultaneous inventory reservations
    // -------------------------------------------------------------
    test("6. (Bonus) Simultaneous inventory reservations are handled safely without over-reservation", async () => {
        // Reset inventory for Product 6: Physical = 100, Reserved = 0
        await pool.query("UPDATE inventory SET physical_quantity = 100, reserved_quantity = 0 WHERE product_id = 6");

        // Create 2 separate Sales Orders for Product 6:
        // Order A requests quantity = 70
        // Order B requests quantity = 50
        // Total requested = 120 > 100 (Only ONE can succeed!)

        // Helper to setup order for Product 6
        async function createOrder(num, qty) {
            const enq = await request("/enquiries", {
                method: "POST",
                token: salesToken,
                body: { enquiry_number: `CONC-ENQ-${num}`, customer_id: 1, items: [{ product_id: 6, quantity: qty }] }
            });
            const quo = await request("/quotations", {
                method: "POST",
                token: salesToken,
                body: { quotation_number: `CONC-QUO-${num}`, enquiry_id: enq.data.enquiry.id, items: [{ product_id: 6, quantity: qty }] }
            });
            await request(`/quotations/${quo.data.quotation.id}/status`, { method: "PATCH", token: salesToken, body: { status: "SENT" } });
            await request(`/quotations/${quo.data.quotation.id}/status`, { method: "PATCH", token: salesToken, body: { status: "ACCEPTED" } });
            const so = await request(`/quotations/${quo.data.quotation.id}/convert`, { method: "POST", token: salesToken });
            return so.data.sales_order.id;
        }

        const orderA = await createOrder("A", 70);
        const orderB = await createOrder("B", 50);

        // Fire both confirmation requests simultaneously
        const [resA, resB] = await Promise.all([
            request(`/sales-orders/${orderA}/confirm`, { method: "POST", token: adminToken }),
            request(`/sales-orders/${orderB}/confirm`, { method: "POST", token: adminToken })
        ]);

        const statuses = [resA.status, resB.status].sort();
        
        // One must succeed (200) and one must fail with insufficient stock (400)
        assert.deepEqual(statuses, [200, 400], "Simultaneous reservation must allow exactly one request to succeed");

        // Check inventory state in database
        const invResult = await pool.query("SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = 6");
        const inv = invResult.rows[0];

        assert.equal(Number(inv.physical_quantity), 100, "Physical quantity should remain 100 during reservation");
        assert.ok(Number(inv.reserved_quantity) <= 100, "Reserved quantity must never exceed physical quantity");
    });
});
