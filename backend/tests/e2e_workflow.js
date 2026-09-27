const http = require("http");
const fs = require("fs");
const path = require("path");
const app = require("../src/server");
const pool = require("../src/config/db");

async function runE2E() {
    console.log("=== STARTING END-TO-END WORKFLOW VERIFICATION ===");

    // 1. Reset Database
    const schema = fs.readFileSync(path.join(__dirname, "../../database/schema.sql"), "utf8");
    const seed = fs.readFileSync(path.join(__dirname, "../../database/seed.sql"), "utf8");
    await pool.query(schema);
    await pool.query(seed);

    // 2. Start HTTP server
    let server;
    let baseUrl;
    await new Promise((resolve) => {
        server = http.createServer(app).listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}/api`;
            resolve();
        });
    });

    async function req(endpoint, method = "GET", token = null, body = null) {
        const res = await fetch(`${baseUrl}${endpoint}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        return { status: res.status, data: await res.json() };
    }

    try {
        // STEP 1: SALES_USER Login
        console.log("\n1. SALES_USER Login...");
        const salesLogin = await req("/auth/login", "POST", null, { email: "sales@erp.com", password: "Sales@123" });
        const salesToken = salesLogin.data.token;
        console.log("   -> Logged in as SALES_USER:", salesLogin.data.user.email);

        // STEP 2: Create Customer
        console.log("\n2. Create Customer...");
        const custRes = await req("/customers", "POST", salesToken, {
            company_name: "Apex Manufacturing Ltd",
            contact_person: "Vikram Sharma",
            mobile: "9820012345",
            email: "vikram@apexmfgg.com",
            city: "Pune"
        });
        const customerId = custRes.data.customer.id;
        console.log("   -> Created Customer ID:", customerId, "(Company:", custRes.data.customer.company_name, ")");

        // STEP 3: Create Enquiry with Multiple Products
        console.log("\n3. Create Enquiry with multiple products...");
        const enqRes = await req("/enquiries", "POST", salesToken, {
            enquiry_number: "ENQ-APEX-001",
            customer_id: customerId,
            notes: "Require urgent delivery for factory expansion",
            items: [
                { product_id: 1, quantity: 10 }, // Heavy duty pump
                { product_id: 5, quantity: 20 }  // Stainless valve
            ]
        });
        const enquiryId = enqRes.data.enquiry.id;
        console.log("   -> Created Enquiry ID:", enquiryId, "Status:", enqRes.data.enquiry.status);

        // STEP 4: Create Quotation
        console.log("\n4. Create Quotation...");
        const quoRes = await req("/quotations", "POST", salesToken, {
            quotation_number: "QUO-APEX-001",
            enquiry_id: enquiryId,
            valid_until: "2026-12-31",
            items: [
                { product_id: 1, quantity: 10, discount_percent: 5, gst_percent: 18 },
                { product_id: 5, quantity: 20, discount_percent: 10, gst_percent: 18 }
            ]
        });
        const quotationId = quoRes.data.quotation.id;
        console.log("   -> Quotation Created. Subtotal:", quoRes.data.quotation.subtotal, "Discount:", quoRes.data.quotation.total_discount, "GST:", quoRes.data.quotation.total_gst, "Grand Total:", quoRes.data.quotation.grand_total);

        // STEP 5: Send & Accept Quotation
        console.log("\n5. Send and Accept Quotation...");
        await req(`/quotations/${quotationId}/status`, "PATCH", salesToken, { status: "SENT" });
        const acceptRes = await req(`/quotations/${quotationId}/status`, "PATCH", salesToken, { status: "ACCEPTED" });
        console.log("   -> Quotation Status:", acceptRes.data.quotation.status);

        // STEP 6: Convert Quotation to Sales Order
        console.log("\n6. Convert Quotation to Sales Order...");
        const convertRes = await req(`/quotations/${quotationId}/convert`, "POST", salesToken);
        const salesOrderId = convertRes.data.sales_order.id;
        console.log("   -> Sales Order Created ID:", salesOrderId, "Order #:", convertRes.data.sales_order.order_number, "Total Amount:", convertRes.data.sales_order.total_amount);

        // STEP 7: ADMIN Login & View Order
        console.log("\n7. ADMIN Login...");
        const adminLogin = await req("/auth/login", "POST", null, { email: "admin@erp.com", password: "Admin@123" });
        const adminToken = adminLogin.data.token;
        console.log("   -> Logged in as ADMIN:", adminLogin.data.user.email);

        // STEP 8: Confirm Sales Order (Stock Reservation)
        console.log("\n8. Confirm Sales Order & Reserve Inventory...");
        const confirmRes = await req(`/sales-orders/${salesOrderId}/confirm`, "POST", adminToken);
        console.log("   -> Order Status after confirm:", confirmRes.data.sales_order.status);

        // Check Inventory state
        const invRes = await req("/inventory", "GET", adminToken);
        console.log("   -> Inventory state after reservation:");
        invRes.data.forEach(item => {
            if ([1, 5].includes(item.product_id)) {
                console.log(`      Product ${item.product_id} (${item.product_name}): Physical=${item.physical_quantity}, Reserved=${item.reserved_quantity}, Available=${item.available_quantity}`);
            }
        });

        // STEP 9: Dispatch Sales Order
        console.log("\n9. Dispatch Sales Order...");
        const dispatchRes = await req(`/sales-orders/${salesOrderId}/dispatch`, "POST", adminToken, {
            dispatch_number: "DSP-APEX-001",
            vehicle_number: "MH-12-AB-9999",
            driver_name: "Ramesh Singh"
        });
        console.log("   -> Dispatch completed. Sales Order Status:", dispatchRes.data.sales_order.status);

        // Final Inventory check
        const finalInvRes = await req("/inventory", "GET", adminToken);
        console.log("   -> Final Inventory state after dispatch:");
        finalInvRes.data.forEach(item => {
            if ([1, 5].includes(item.product_id)) {
                console.log(`      Product ${item.product_id} (${item.product_name}): Physical=${item.physical_quantity}, Reserved=${item.reserved_quantity}, Available=${item.available_quantity}`);
            }
        });

        console.log("\n=== END-TO-END WORKFLOW VERIFICATION SUCCESSFUL ===");

    } catch (err) {
        console.error("E2E Workflow Error:", err);
    } finally {
        server.close();
        await pool.end();
    }
}

runE2E();
