import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function App() {
    const [loggedIn, setLoggedIn] = useState(
        !!localStorage.getItem("erp_token")
    );

    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("erp_user")) || null;
        } catch {
            return null;
        }
    });

    const [activePage, setActivePage] = useState("Dashboard");

    const [inventory, setInventory] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [enquiries, setEnquiries] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [salesOrders, setSalesOrders] = useState([]);
    const [dispatches, setDispatches] = useState([]);
    const [products, setProducts] = useState([]);

    const [loading, setLoading] = useState(false);

    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [showEnquiryForm, setShowEnquiryForm] = useState(false);
    const [showQuotationForm, setShowQuotationForm] = useState(false);
    const [showDispatchForm, setShowDispatchForm] = useState(false);

    const [selectedOrder, setSelectedOrder] = useState(null);

    const token = localStorage.getItem("erp_token");

    const isAdmin = user?.role === "ADMIN";
    const isSales = user?.role === "SALES_USER";


    // API HELPER
  

    const apiRequest = async (url, options = {}) => {
        const currentToken = localStorage.getItem("erp_token");

        const response = await fetch(`${API}${url}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(currentToken
                    ? { Authorization: `Bearer ${currentToken}` }
                    : {}),
                ...(options.headers || {})
            }
        });

        const text = await response.text();

        let data = {};

        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { message: text };
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed with status ${response.status}`
            );
        }

        return data;
    };

    // LOGIN


    const handleLogin = async (email, password) => {
        try {
            setLoading(true);

            const data = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const jwt =
                data.token ||
                data.accessToken ||
                data.access_token;

            if (!jwt) {
                throw new Error("Login successful but token was not returned.");
            }

            localStorage.setItem("erp_token", jwt);

            const loggedUser =
                data.user ||
                {
                    email,
                    role:
                        data.role ||
                        data.userRole ||
                        "SALES_USER"
                };

            localStorage.setItem(
                "erp_user",
                JSON.stringify(loggedUser)
            );

            setUser(loggedUser);
            setLoggedIn(true);

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_user");

        setLoggedIn(false);
        setUser(null);
    };


    // FETCH FUNCTIONS
 

    const fetchProducts = async () => {
        try {
            const data = await apiRequest("/products");

            setProducts(
                Array.isArray(data)
                    ? data
                    : data.products || []
            );
        } catch (error) {
            console.error("Products:", error);
        }
    };

    const fetchInventory = async () => {
        try {
            const data = await apiRequest("/inventory");

            setInventory(
                Array.isArray(data)
                    ? data
                    : data.inventory || []
            );
        } catch (error) {
            console.error("Inventory:", error);
        }
    };

    const fetchCustomers = async () => {
        try {
            const data = await apiRequest("/customers");

            setCustomers(
                Array.isArray(data)
                    ? data
                    : data.customers || []
            );
        } catch (error) {
            console.error("Customers:", error);
        }
    };

    const fetchEnquiries = async () => {
        try {
            const data = await apiRequest("/enquiries");

            setEnquiries(
                Array.isArray(data)
                    ? data
                    : data.enquiries || []
            );
        } catch (error) {
            console.error("Enquiries:", error);
        }
    };

    const fetchQuotations = async () => {
        try {
            const data = await apiRequest("/quotations");

            const list =
                Array.isArray(data)
                    ? data
                    : data.quotations || [];

            const detailed = await Promise.all(
                list.map(async (quotation) => {
                    try {
                        return await apiRequest(
                            `/quotations/${quotation.id}`
                        );
                    } catch {
                        return quotation;
                    }
                })
            );

            setQuotations(detailed);
        } catch (error) {
            console.error("Quotations:", error);
        }
    };

    const fetchSalesOrders = async () => {
        try {
            const data = await apiRequest("/sales-orders");

            setSalesOrders(
                Array.isArray(data)
                    ? data
                    : data.salesOrders ||
                      data.sales_orders ||
                      []
            );
        } catch (error) {
            console.error("Sales Orders:", error);
        }
    };

    const fetchDispatches = async () => {
        try {
            const data = await apiRequest("/dispatches");

            setDispatches(
                Array.isArray(data)
                    ? data
                    : data.dispatches || []
            );
        } catch (error) {
            console.error("Dispatches:", error);
        }
    };

    const refreshAll = async () => {
        await Promise.all([
            fetchProducts(),
            fetchInventory(),
            fetchCustomers(),
            fetchEnquiries(),
            fetchQuotations(),
            fetchSalesOrders(),
            fetchDispatches()
        ]);
    };

    useEffect(() => {
        if (loggedIn && token) {
            refreshAll();
        }
    }, [loggedIn]);

    // --------------------------------------------------
    // CUSTOMER
    // --------------------------------------------------

    const createCustomer = async (form) => {
        try {
            setLoading(true);

            await apiRequest("/customers", {
                method: "POST",
                body: JSON.stringify({
                    company_name: form.company_name,
                    contact_person: form.contact_person,
                    mobile: form.mobile,
                    email: form.email,
                    city: form.city
                })
            });

            alert("Customer created successfully.");

            setShowCustomerForm(false);

            await fetchCustomers();

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // ENQUIRY


    const createEnquiry = async (form) => {
        try {
            setLoading(true);

            await apiRequest("/enquiries", {
                method: "POST",
                body: JSON.stringify({
                    enquiry_number: form.enquiry_number,
                    customer_id: Number(form.customer_id),
                    enquiry_date: form.enquiry_date,
                    required_date: form.required_date,
                    notes: form.notes,
                    status: "NEW",
                    items: form.items.map(item => ({
                        product_id: Number(item.product_id),
                        quantity: Number(item.quantity)
                    }))
                })
            });

            alert("Enquiry created successfully.");

            setShowEnquiryForm(false);

            await fetchEnquiries();

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // QUOTATION


    const createQuotation = async (form) => {
        try {
            setLoading(true);

            await apiRequest("/quotations", {
                method: "POST",
                body: JSON.stringify({
                    quotation_number: form.quotation_number,
                    enquiry_id: Number(form.enquiry_id),
                    quotation_date: form.quotation_date,
                    valid_until: form.valid_until,
                    status: "DRAFT",
                    items: form.items.map(item => ({
                        product_id: Number(item.product_id),
                        quantity: Number(item.quantity),
                        unit_price: Number(item.unit_price),
                        discount_percent:
                            Number(item.discount_percent || 0),
                        gst_percent:
                            Number(item.gst_percent || 0)
                    }))
                })
            });

            alert("Quotation created successfully.");

            setShowQuotationForm(false);

            await Promise.all([
                fetchQuotations(),
                fetchEnquiries()
            ]);

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };


    // QUOTATION STATUS
  

    const updateQuotationStatus = async (id, status) => {
        try {
            setLoading(true);

            await apiRequest(
                `/quotations/${id}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ status })
                }
            );

            alert(`Quotation marked ${status}.`);

            await Promise.all([
                fetchQuotations(),
                fetchEnquiries()
            ]);

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

   
    // CONVERT QUOTATION TO SALES ORDER


    const convertQuotation = async (id) => {
        try {
            setLoading(true);

            await apiRequest(
                `/quotations/${id}/convert`,
                {
                    method: "POST"
                }
            );

            alert("Sales Order created successfully.");

            await Promise.all([
                fetchQuotations(),
                fetchSalesOrders()
            ]);

            setActivePage("Sales Orders");

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    
    // CREATE SALES ORDER
    

    const createSalesOrder = async (quotation) => {
        try {
            setLoading(true);

            await apiRequest("/sales-orders", {
                method: "POST",
                body: JSON.stringify({
                    quotation_id: Number(quotation.id),
                    customer_id: Number(
                        quotation.customer_id ||
                        quotation.customer?.id ||
                        quotation.enquiry_customer_id
                    ),
                    order_date: new Date()
                        .toISOString()
                        .split("T")[0],
                    items: (
                        quotation.items ||
                        quotation.quotation_items ||
                        []
                    ).map(item => ({
                        product_id: Number(
                            item.product_id
                        ),
                        quantity: Number(
                            item.quantity
                        ),
                        unit_price: Number(
                            item.unit_price
                        )
                    }))
                })
            });

            alert("Sales Order created.");

            await fetchSalesOrders();

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    
    // CONFIRM SALES ORDER
    

    const confirmSalesOrder = async (id) => {
        try {
            setLoading(true);

            await apiRequest(
                `/sales-orders/${id}/confirm`,
                {
                    method: "PUT"
                }
            );

            alert(
                "Sales Order confirmed and inventory reserved."
            );

            await Promise.all([
                fetchSalesOrders(),
                fetchInventory()
            ]);

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    
    // DISPATCH
    

    const processDispatch = async (form) => {
        try {
            setLoading(true);

            await apiRequest("/dispatches", {
                method: "POST",
                body: JSON.stringify({
                    dispatch_number:
                        form.dispatch_number,
                    sales_order_id:
                        Number(form.sales_order_id),
                    dispatch_date:
                        form.dispatch_date,
                    vehicle_number:
                        form.vehicle_number,
                    driver_name:
                        form.driver_name,
                    items: form.items.map(item => ({
                        product_id:
                            Number(item.product_id),
                        quantity:
                            Number(item.quantity)
                    }))
                })
            });

            alert("Dispatch completed successfully.");

            setShowDispatchForm(false);
            setSelectedOrder(null);

            await Promise.all([
                fetchSalesOrders(),
                fetchInventory(),
                fetchDispatches()
            ]);

        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };


    // LOGIN SCREEN


    if (!loggedIn) {
        return <LoginPage onLogin={handleLogin} loading={loading} />;
    }


    const money = value =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            maximumFractionDigits: 2
        })}`;

    const statusBadge = status => (
        <span
            style={{
                display: "inline-block",
                padding: "5px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "700",
                background:
                    status === "ACCEPTED" ||
                    status === "CONFIRMED" ||
                    status === "DISPATCHED" ||
                    status === "WON"
                        ? "#dcfce7"
                        : status === "REJECTED" ||
                          status === "CANCELLED" ||
                          status === "LOST"
                        ? "#fee2e2"
                        : "#fef3c7",
                color:
                    status === "ACCEPTED" ||
                    status === "CONFIRMED" ||
                    status === "DISPATCHED" ||
                    status === "WON"
                        ? "#166534"
                        : status === "REJECTED" ||
                          status === "CANCELLED" ||
                          status === "LOST"
                        ? "#991b1b"
                        : "#92400e"
            }}
        >
            {status}
        </span>
    );

    const ActionButton = ({
        children,
        onClick,
        danger = false,
        secondary = false,
        disabled = false
    }) => (
        <button
            disabled={disabled}
            onClick={onClick}
            style={{
                width: "auto",
                padding: "8px 13px",
                marginRight: "6px",
                marginBottom: "5px",
                fontSize: "12px",
                background: danger
                    ? "#dc2626"
                    : secondary
                    ? "#64748b"
                    : "#2563eb",
                opacity: disabled ? 0.5 : 1
            }}
        >
            {children}
        </button>
    );

  
    // DASHBOARD
   

    const renderDashboard = () => {
        const acceptedQuotes = quotations.filter(
            q => q.status === "ACCEPTED"
        ).length;

        const pendingOrders = salesOrders.filter(
            o => o.status === "PENDING"
        ).length;

        const availableProducts = inventory.filter(
            i => Number(i.available_quantity) > 0
        ).length;

        return (
            <>
                <div className="topbar">
                    <div>
                        <h1>Dashboard</h1>
                        <p>
                            ERP business workflow overview
                        </p>
                    </div>

                    <UserInfo user={user} />
                </div>

                <div className="stats-grid">
                    <StatCard
                        icon="👥"
                        title="Customers"
                        value={customers.length}
                    />

                    <StatCard
                        icon="📋"
                        title="Enquiries"
                        value={enquiries.length}
                    />

                    <StatCard
                        icon="💰"
                        title="Accepted Quotations"
                        value={acceptedQuotes}
                    />

                    <StatCard
                        icon="📦"
                        title="Pending Orders"
                        value={pendingOrders}
                    />
                </div>

                <div className="stats-grid">
                    <StatCard
                        icon="🏭"
                        title="Products in Stock"
                        value={availableProducts}
                    />

                    <StatCard
                        icon="🚚"
                        title="Dispatches"
                        value={dispatches.length}
                    />

                    <StatCard
                        icon="🔐"
                        title="Role"
                        value={user?.role || "-"}
                    />

                    <StatCard
                        icon="📊"
                        title="Total Orders"
                        value={salesOrders.length}
                    />
                </div>

                <div className="dashboard-section">
                    <div className="section-header">
                        <h2>ERP Workflow</h2>
                        <p>
                            Customer → Enquiry → Quotation →
                            Sales Order → Reservation → Dispatch
                        </p>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                            alignItems: "center"
                        }}
                    >
                        {[
                            "Customer",
                            "Enquiry",
                            "Quotation",
                            "Sales Order",
                            "Inventory Reservation",
                            "Dispatch"
                        ].map((item, index) => (
                            <div
                                key={item}
                                style={{
                                    padding: "15px 20px",
                                    background: "#eff6ff",
                                    borderRadius: "10px",
                                    color: "#1e40af",
                                    fontWeight: "600"
                                }}
                            >
                                {index + 1}. {item}
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    };

   
    // CUSTOMERS
    

    const renderCustomers = () => (
        <>
            <PageHeader
                title="Customers"
                subtitle="Manage business customers"
                button={
                    isSales && (
                        <ActionButton
                            onClick={() =>
                                setShowCustomerForm(true)
                            }
                        >
                            + New Customer
                        </ActionButton>
                    )
                }
            />

            <div className="dashboard-section">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Company</th>
                                <th>Contact Person</th>
                                <th>Mobile</th>
                                <th>Email</th>
                                <th>City</th>
                            </tr>
                        </thead>

                        <tbody>
                            {customers.length === 0 ? (
                                <EmptyRow
                                    text="No customers found"
                                    columns={6}
                                />
                            ) : (
                                customers.map(customer => (
                                    <tr key={customer.id}>
                                        <td>{customer.id}</td>
                                        <td>
                                            <strong>
                                                {
                                                    customer.company_name
                                                }
                                            </strong>
                                        </td>
                                        <td>
                                            {
                                                customer.contact_person
                                            }
                                        </td>
                                        <td>
                                            {customer.mobile}
                                        </td>
                                        <td>
                                            {customer.email}
                                        </td>
                                        <td>
                                            {customer.city}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    // ENQUIRIES
  

    const renderEnquiries = () => (
        <>
            <PageHeader
                title="Enquiries"
                subtitle="Create and view customer enquiries"
                button={
                    isSales && (
                        <ActionButton
                            onClick={() =>
                                setShowEnquiryForm(true)
                            }
                        >
                            + New Enquiry
                        </ActionButton>
                    )
                }
            />

            <div className="dashboard-section">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Enquiry No.</th>
                                <th>Customer</th>
                                <th>Enquiry Date</th>
                                <th>Required Date</th>
                                <th>Products</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {enquiries.length === 0 ? (
                                <EmptyRow
                                    text="No enquiries found"
                                    columns={6}
                                />
                            ) : (
                                enquiries.map(enquiry => {
                                    const items =
                                        enquiry.items ||
                                        enquiry.enquiry_items ||
                                        [];

                                    return (
                                        <tr key={enquiry.id}>
                                            <td>
                                                <strong>
                                                    {
                                                        enquiry.enquiry_number
                                                    }
                                                </strong>
                                            </td>

                                            <td>
                                                {enquiry.company_name ||
                                                    enquiry.customer_name ||
                                                    enquiry.customer?.company_name ||
                                                    `Customer #${enquiry.customer_id}`}
                                            </td>

                                            <td>
                                                {enquiry.enquiry_date
                                                    ? String(
                                                          enquiry.enquiry_date
                                                      ).split("T")[0]
                                                    : "-"}
                                            </td>

                                            <td>
                                                {enquiry.required_date
                                                    ? String(
                                                          enquiry.required_date
                                                      ).split("T")[0]
                                                    : "-"}
                                            </td>

                                            <td>
                                                {items.length}
                                            </td>

                                            <td>
                                                {statusBadge(
                                                    enquiry.status
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    
    // QUOTATIONS


    const renderQuotations = () => (
        <>
            <PageHeader
                title="Quotations"
                subtitle="Create and manage quotations"
                button={
                    isSales && (
                        <ActionButton
                            onClick={() =>
                                setShowQuotationForm(true)
                            }
                        >
                            + New Quotation
                        </ActionButton>
                    )
                }
            />

            <div className="dashboard-section">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Quotation</th>
                                <th>Enquiry</th>
                                <th>Customer</th>
                                <th>Grand Total</th>
                                <th>Valid Until</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {quotations.length === 0 ? (
                                <EmptyRow
                                    text="No quotations found"
                                    columns={7}
                                />
                            ) : (
                                quotations.map(q => (
                                    <tr key={q.id}>
                                        <td>
                                            <strong>
                                                {
                                                    q.quotation_number
                                                }
                                            </strong>
                                        </td>

                                        <td>
                                            {q.enquiry_number ||
                                                `ENQ-${q.enquiry_id}`}
                                        </td>

                                        <td>
                                            {q.company_name ||
                                                q.customer_name ||
                                                q.customer?.company_name ||
                                                "-"}
                                        </td>

                                        <td>
                                            {money(
                                                q.grand_total ??
                                                    q.total_amount
                                            )}
                                        </td>

                                        <td>
                                            {q.valid_until
                                                ? String(
                                                      q.valid_until
                                                  ).split("T")[0]
                                                : "-"}
                                        </td>

                                        <td>
                                            {statusBadge(q.status)}
                                        </td>

                                        <td>
                                            {isSales &&
                                                q.status ===
                                                    "DRAFT" && (
                                                    <>
                                                        <ActionButton
                                                            onClick={() =>
                                                                updateQuotationStatus(
                                                                    q.id,
                                                                    "SENT"
                                                                )
                                                            }
                                                        >
                                                            Send
                                                        </ActionButton>

                                                        <ActionButton
                                                            danger
                                                            onClick={() =>
                                                                updateQuotationStatus(
                                                                    q.id,
                                                                    "REJECTED"
                                                                )
                                                            }
                                                        >
                                                            Reject
                                                        </ActionButton>
                                                    </>
                                                )}

                                            {isSales &&
                                                q.status ===
                                                    "SENT" && (
                                                    <>
                                                        <ActionButton
                                                            onClick={() =>
                                                                updateQuotationStatus(
                                                                    q.id,
                                                                    "ACCEPTED"
                                                                )
                                                            }
                                                        >
                                                            Accept
                                                        </ActionButton>

                                                        <ActionButton
                                                            danger
                                                            onClick={() =>
                                                                updateQuotationStatus(
                                                                    q.id,
                                                                    "REJECTED"
                                                                )
                                                            }
                                                        >
                                                            Reject
                                                        </ActionButton>
                                                    </>
                                                )}

                                            {isSales &&
                                                q.status ===
                                                    "ACCEPTED" && (
                                                    <ActionButton
                                                        onClick={() =>
                                                            convertQuotation(
                                                                q.id
                                                            )
                                                        }
                                                    >
                                                        Convert to Order
                                                    </ActionButton>
                                                )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    // SALES ORDERS
    

    const renderSalesOrders = () => (
        <>
            <PageHeader
                title="Sales Orders"
                subtitle="Manage orders, stock reservation and dispatch"
            />

            <div className="dashboard-section">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Quotation</th>
                                <th>Date</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {salesOrders.length === 0 ? (
                                <EmptyRow
                                    text="No sales orders found"
                                    columns={7}
                                />
                            ) : (
                                salesOrders.map(order => (
                                    <tr key={order.id}>
                                        <td>
                                            <strong>
                                                {
                                                    order.order_number
                                                }
                                            </strong>
                                        </td>

                                        <td>
                                            {order.company_name ||
                                                order.customer_name ||
                                                order.customer?.company_name ||
                                                "-"}
                                        </td>

                                        <td>
                                            {order.quotation_number ||
                                                `QUO-${order.quotation_id}`}
                                        </td>

                                        <td>
                                            {order.order_date
                                                ? String(
                                                      order.order_date
                                                  ).split("T")[0]
                                                : "-"}
                                        </td>

                                        <td>
                                            {money(
                                                order.total_amount
                                            )}
                                        </td>

                                        <td>
                                            {statusBadge(
                                                order.status
                                            )}
                                        </td>

                                        <td>
                                            {isAdmin &&
                                                order.status ===
                                                    "PENDING" && (
                                                    <ActionButton
                                                        onClick={() =>
                                                            confirmSalesOrder(
                                                                order.id
                                                            )
                                                        }
                                                    >
                                                        Confirm & Reserve
                                                    </ActionButton>
                                                )}

                                            {order.status ===
                                                "CONFIRMED" &&
                                                isAdmin && (
                                                    <ActionButton
                                                        onClick={() => {
                                                            setSelectedOrder(
                                                                order
                                                            );
                                                            setShowDispatchForm(
                                                                true
                                                            );
                                                        }}
                                                    >
                                                        Dispatch
                                                    </ActionButton>
                                                )}

                                            {order.status ===
                                                "DISPATCHED" && (
                                                <span
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#166534"
                                                    }}
                                                >
                                                    ✓ Completed
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div
                className="dashboard-section"
                style={{ marginTop: "20px" }}
            >
                <div className="section-header">
                    <h2>Inventory Availability</h2>
                    <p>
                        Physical − Reserved = Available
                    </p>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Physical</th>
                                <th>Reserved</th>
                                <th>Available</th>
                            </tr>
                        </thead>

                        <tbody>
                            {inventory.map(item => (
                                <tr key={item.product_id}>
                                    <td>
                                        <strong>
                                            {item.product_name}
                                        </strong>
                                    </td>

                                    <td>
                                        {
                                            item.physical_quantity
                                        }
                                    </td>

                                    <td>
                                        {
                                            item.reserved_quantity
                                        }
                                    </td>

                                    <td>
                                        <span className="stock-badge">
                                            {
                                                item.available_quantity
                                            }
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

  
    // INVENTORY


    const renderInventory = () => (
        <>
            <PageHeader
                title="Inventory"
                subtitle="View physical, reserved and available stock"
            />

            <div className="dashboard-section">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Product Code</th>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Unit</th>
                                <th>Base Price</th>
                                <th>Physical</th>
                                <th>Reserved</th>
                                <th>Available</th>
                            </tr>
                        </thead>

                        <tbody>
                            {inventory.map(item => (
                                <tr key={item.product_id}>
                                    <td>
                                        {item.product_code}
                                    </td>

                                    <td>
                                        <strong>
                                            {
                                                item.product_name
                                            }
                                        </strong>
                                    </td>

                                    <td>
                                        {item.category}
                                    </td>

                                    <td>
                                        {item.unit}
                                    </td>

                                    <td>
                                        {money(
                                            item.base_price
                                        )}
                                    </td>

                                    <td>
                                        {
                                            item.physical_quantity
                                        }
                                    </td>

                                    <td>
                                        {
                                            item.reserved_quantity
                                        }
                                    </td>

                                    <td>
                                        <span className="stock-badge">
                                            {
                                                item.available_quantity
                                            }
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    // DISPATCHES


    const renderDispatches = () => (
        <>
            <PageHeader
                title="Dispatches"
                subtitle="Completed dispatch records"
            />

            <div className="dashboard-section">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Dispatch No.</th>
                                <th>Sales Order</th>
                                <th>Date</th>
                                <th>Vehicle</th>
                                <th>Driver</th>
                            </tr>
                        </thead>

                        <tbody>
                            {dispatches.length === 0 ? (
                                <EmptyRow
                                    text="No dispatches found"
                                    columns={5}
                                />
                            ) : (
                                dispatches.map(dispatch => (
                                    <tr key={dispatch.id}>
                                        <td>
                                            <strong>
                                                {
                                                    dispatch.dispatch_number
                                                }
                                            </strong>
                                        </td>

                                        <td>
                                            {dispatch.order_number ||
                                                `SO-${dispatch.sales_order_id}`}
                                        </td>

                                        <td>
                                            {dispatch.dispatch_date
                                                ? String(
                                                      dispatch.dispatch_date
                                                  ).split("T")[0]
                                                : "-"}
                                        </td>

                                        <td>
                                            {
                                                dispatch.vehicle_number
                                            }
                                        </td>

                                        <td>
                                            {
                                                dispatch.driver_name
                                            }
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

   
    // PAGE SWITCH


    const renderPage = () => {
        switch (activePage) {
            case "Customers":
                return renderCustomers();

            case "Enquiries":
                return renderEnquiries();

            case "Quotations":
                return renderQuotations();

            case "Sales Orders":
                return renderSalesOrders();

            case "Inventory":
                return renderInventory();

            case "Dispatches":
                return renderDispatches();

            default:
                return renderDashboard();
        }
    };

   
    // MAIN UI
   

    return (
        <div className="dashboard">

            <aside className="sidebar">

                <div className="sidebar-logo">
                    <div className="logo small-logo">
                        ERP
                    </div>

                    <div>
                        <h2>ERP System</h2>
                        <span>
                            Manufacturing & Supply
                        </span>
                    </div>
                </div>

                <nav>

                    {[
                        "Dashboard",
                        "Customers",
                        "Enquiries",
                        "Quotations",
                        "Sales Orders",
                        "Inventory",
                        "Dispatches"
                    ].map(page => (
                        <div
                            key={page}
                            className={`nav-item ${
                                activePage === page
                                    ? "active"
                                    : ""
                            }`}
                            onClick={() =>
                                setActivePage(page)
                            }
                        >
                            {page === "Dashboard" && "📊 "}
                            {page === "Customers" && "👥 "}
                            {page === "Enquiries" && "📋 "}
                            {page === "Quotations" && "💰 "}
                            {page === "Sales Orders" && "📦 "}
                            {page === "Inventory" && "🏭 "}
                            {page === "Dispatches" && "🚚 "}

                            {page}
                        </div>
                    ))}

                </nav>

                <button
                    className="logout-button"
                    onClick={handleLogout}
                >
                    Logout
                </button>

            </aside>

            <main className="main-content">

                {renderPage()}

            </main>

            {/* CUSTOMER FORM */}

            {showCustomerForm && (
                <CustomerForm
                    onClose={() =>
                        setShowCustomerForm(false)
                    }
                    onSubmit={createCustomer}
                    loading={loading}
                />
            )}

            {/* ENQUIRY FORM */}

            {showEnquiryForm && (
                <EnquiryForm
                    customers={customers}
                    products={products}
                    onClose={() =>
                        setShowEnquiryForm(false)
                    }
                    onSubmit={createEnquiry}
                    loading={loading}
                />
            )}

            {/* QUOTATION FORM */}

            {showQuotationForm && (
                <QuotationForm
                    enquiries={enquiries}
                    products={products}
                    onClose={() =>
                        setShowQuotationForm(false)
                    }
                    onSubmit={createQuotation}
                    loading={loading}
                />
            )}

            {/* DISPATCH FORM */}

            {showDispatchForm && selectedOrder && (
                <DispatchForm
                    order={selectedOrder}
                    products={products}
                    onClose={() => {
                        setShowDispatchForm(false);
                        setSelectedOrder(null);
                    }}
                    onSubmit={processDispatch}
                    loading={loading}
                />
            )}

        </div>
    );
}



// LOGIN COMPONENT


function LoginPage({ onLogin, loading }) {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const submit = e => {
        e.preventDefault();

        if (!email || !password) {
            alert("Please enter email and password.");
            return;
        }

        onLogin(email, password);
    };

    return (
        <div className="login-page">

            <div className="login-card">

                <div className="logo-section">

                    <div className="logo">
                        ERP
                    </div>

                    <h1>ERP System</h1>

                    <p>
                        Manufacturing & Supply Management
                    </p>

                </div>

                <form onSubmit={submit}>

                    <div className="form-group">

                        <label>Email</label>

                        <input
                            type="email"
                            value={email}
                            onChange={e =>
                                setEmail(e.target.value)
                            }
                            placeholder="Enter email"
                        />

                    </div>

                    <div className="form-group">

                        <label>Password</label>

                        <input
                            type="password"
                            value={password}
                            onChange={e =>
                                setPassword(e.target.value)
                            }
                            placeholder="Enter password"
                        />

                    </div>

                    <button type="submit" disabled={loading}>
                        {loading
                            ? "Logging in..."
                            : "Login"}
                    </button>

                </form>

                <div className="demo-info">

                    <p>
                        Admin: admin@erp.com / Admin@123
                    </p>

                    <p>
                        Sales: sales@erp.com / Sales@123
                    </p>

                </div>

            </div>

        </div>
    );
}



// CUSTOMER FORM


function CustomerForm({
    onClose,
    onSubmit,
    loading
}) {

    const [form, setForm] = useState({
        company_name: "",
        contact_person: "",
        mobile: "",
        email: "",
        city: ""
    });

    const change = (field, value) => {
        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <Modal
            title="Create Customer"
            onClose={onClose}
        >

            <FormInput
                label="Company Name"
                value={form.company_name}
                onChange={v =>
                    change("company_name", v)
                }
            />

            <FormInput
                label="Contact Person"
                value={form.contact_person}
                onChange={v =>
                    change("contact_person", v)
                }
            />

            <FormInput
                label="Mobile"
                value={form.mobile}
                onChange={v =>
                    change("mobile", v)
                }
            />

            <FormInput
                label="Email"
                type="email"
                value={form.email}
                onChange={v =>
                    change("email", v)
                }
            />

            <FormInput
                label="City"
                value={form.city}
                onChange={v =>
                    change("city", v)
                }
            />

            <FormButtons
                onClose={onClose}
                onSubmit={() => onSubmit(form)}
                loading={loading}
                text="Create Customer"
            />

        </Modal>
    );
}



// ENQUIRY FORM


function EnquiryForm({
    customers,
    products,
    onClose,
    onSubmit,
    loading
}) {

    const today =
        new Date().toISOString().split("T")[0];

    const [form, setForm] = useState({
        enquiry_number: `ENQ-${Date.now()}`,
        customer_id: "",
        enquiry_date: today,
        required_date: "",
        notes: "",
        items: [
            {
                product_id: "",
                quantity: 1
            }
        ]
    });

    const update = (field, value) => {
        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const updateItem = (index, field, value) => {

        const items = [...form.items];

        items[index] = {
            ...items[index],
            [field]: value
        };

        setForm(prev => ({
            ...prev,
            items
        }));
    };

    const addItem = () => {

        setForm(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    product_id: "",
                    quantity: 1
                }
            ]
        }));
    };

    const removeItem = index => {

        if (form.items.length === 1) return;

        setForm(prev => ({
            ...prev,
            items: prev.items.filter(
                (_, i) => i !== index
            )
        }));
    };

    return (
        <Modal
            title="Create Customer Enquiry"
            onClose={onClose}
            wide
        >

            <div className="form-grid">

                <FormInput
                    label="Enquiry Number"
                    value={form.enquiry_number}
                    onChange={v =>
                        update("enquiry_number", v)
                    }
                />

                <FormSelect
                    label="Customer"
                    value={form.customer_id}
                    onChange={v =>
                        update("customer_id", v)
                    }
                    options={customers.map(c => ({
                        value: c.id,
                        label: c.company_name
                    }))}
                    placeholder="Select customer"
                />

                <FormInput
                    label="Enquiry Date"
                    type="date"
                    value={form.enquiry_date}
                    onChange={v =>
                        update("enquiry_date", v)
                    }
                />

                <FormInput
                    label="Required Date"
                    type="date"
                    value={form.required_date}
                    onChange={v =>
                        update("required_date", v)
                    }
                />

            </div>

            <h3 style={{ margin: "20px 0 10px" }}>
                Products
            </h3>

            {form.items.map((item, index) => (

                <div
                    key={index}
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "1fr 150px 90px",
                        gap: "10px",
                        marginBottom: "10px"
                    }}
                >

                    <FormSelect
                        label=""
                        value={item.product_id}
                        onChange={v =>
                            updateItem(
                                index,
                                "product_id",
                                v
                            )
                        }
                        options={products.map(p => ({
                            value: p.id,
                            label: `${p.product_name} (${p.product_code})`
                        }))}
                        placeholder="Select product"
                    />

                    <FormInput
                        label=""
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={v =>
                            updateItem(
                                index,
                                "quantity",
                                v
                            )
                        }
                    />

                    <button
                        type="button"
                        onClick={() =>
                            removeItem(index)
                        }
                        style={{
                            background: "#dc2626",
                            padding: "10px"
                        }}
                    >
                        Remove
                    </button>

                </div>

            ))}

            <button
                type="button"
                onClick={addItem}
                style={{
                    width: "auto",
                    background: "#64748b",
                    padding: "9px 15px",
                    marginBottom: "15px"
                }}
            >
                + Add Product
            </button>

            <FormInput
                label="Notes"
                value={form.notes}
                onChange={v =>
                    update("notes", v)
                }
                textarea
            />

            <FormButtons
                onClose={onClose}
                onSubmit={() => onSubmit(form)}
                loading={loading}
                text="Create Enquiry"
            />

        </Modal>
    );
}


// QUOTATION FORM


function QuotationForm({
    enquiries,
    products,
    onClose,
    onSubmit,
    loading
}) {

    const today =
        new Date().toISOString().split("T")[0];

    const [form, setForm] = useState({
        quotation_number: `QUO-${Date.now()}`,
        enquiry_id: "",
        quotation_date: today,
        valid_until: "",
        items: [
            {
                product_id: "",
                quantity: 1,
                unit_price: "",
                discount_percent: 0,
                gst_percent: 18
            }
        ]
    });

    const selectedEnquiry = enquiries.find(
        e => Number(e.id) === Number(form.enquiry_id)
    );

    const update = (field, value) => {
        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const updateItem = (index, field, value) => {

        const items = [...form.items];

        items[index] = {
            ...items[index],
            [field]: value
        };

        setForm(prev => ({
            ...prev,
            items
        }));
    };

    const addItem = () => {

        setForm(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    product_id: "",
                    quantity: 1,
                    unit_price: "",
                    discount_percent: 0,
                    gst_percent: 18
                }
            ]
        }));
    };

    const removeItem = index => {

        if (form.items.length === 1) return;

        setForm(prev => ({
            ...prev,
            items: prev.items.filter(
                (_, i) => i !== index
            )
        }));
    };

    const total = form.items.reduce(
        (sum, item) => {

            const qty = Number(item.quantity || 0);
            const price = Number(
                item.unit_price || 0
            );
            const discount = Number(
                item.discount_percent || 0
            );
            const gst = Number(
                item.gst_percent || 0
            );

            const base = qty * price;
            const afterDiscount =
                base - base * discount / 100;

            const final =
                afterDiscount +
                afterDiscount * gst / 100;

            return sum + final;

        },
        0
    );

    return (
        <Modal
            title="Create Quotation"
            onClose={onClose}
            wide
        >

            <div className="form-grid">

                <FormInput
                    label="Quotation Number"
                    value={form.quotation_number}
                    onChange={v =>
                        update(
                            "quotation_number",
                            v
                        )
                    }
                />

                <FormSelect
                    label="Enquiry"
                    value={form.enquiry_id}
                    onChange={v => {

                        update("enquiry_id", v);

                        const enquiry =
                            enquiries.find(
                                e =>
                                    Number(e.id) ===
                                    Number(v)
                            );

                        const enquiryItems =
                            enquiry?.items ||
                            enquiry?.enquiry_items ||
                            [];

                        if (enquiryItems.length) {

                            setForm(prev => ({
                                ...prev,
                                items:
                                    enquiryItems.map(
                                        item => {

                                            const product =
                                                products.find(
                                                    p =>
                                                        Number(
                                                            p.id
                                                        ) ===
                                                        Number(
                                                            item.product_id
                                                        )
                                                );

                                            return {
                                                product_id:
                                                    item.product_id,
                                                quantity:
                                                    item.quantity,
                                                unit_price:
                                                    product?.base_price ||
                                                    "",
                                                discount_percent: 0,
                                                gst_percent: 18
                                            };
                                        }
                                    )
                            }));

                        }

                    }}
                    options={enquiries.map(e => ({
                        value: e.id,
                        label: `${e.enquiry_number} - ${
                            e.company_name ||
                            e.customer_name ||
                            e.customer?.company_name ||
                            "Customer"
                        }`
                    }))}
                    placeholder="Select enquiry"
                />

                <FormInput
                    label="Quotation Date"
                    type="date"
                    value={form.quotation_date}
                    onChange={v =>
                        update(
                            "quotation_date",
                            v
                        )
                    }
                />

                <FormInput
                    label="Valid Until"
                    type="date"
                    value={form.valid_until}
                    onChange={v =>
                        update(
                            "valid_until",
                            v
                        )
                    }
                />

            </div>

            {selectedEnquiry && (
                <div
                    style={{
                        background: "#eff6ff",
                        padding: "12px",
                        borderRadius: "8px",
                        margin: "15px 0"
                    }}
                >
                    <strong>Customer: </strong>
                    {selectedEnquiry.company_name ||
                        selectedEnquiry.customer_name ||
                        selectedEnquiry.customer?.company_name ||
                        "Selected customer"}
                </div>
            )}

            <h3 style={{ margin: "20px 0 10px" }}>
                Quotation Products
            </h3>

            {form.items.map((item, index) => (

                <div
                    key={index}
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "1.5fr 90px 130px 100px 100px 80px",
                        gap: "8px",
                        marginBottom: "10px",
                        alignItems: "end"
                    }}
                >

                    <FormSelect
                        label={index === 0 ? "Product" : ""}
                        value={item.product_id}
                        onChange={v =>
                            updateItem(
                                index,
                                "product_id",
                                v
                            )
                        }
                        options={products.map(p => ({
                            value: p.id,
                            label: p.product_name
                        }))}
                        placeholder="Product"
                    />

                    <FormInput
                        label={index === 0 ? "Qty" : ""}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={v =>
                            updateItem(
                                index,
                                "quantity",
                                v
                            )
                        }
                    />

                    <FormInput
                        label={
                            index === 0
                                ? "Unit Price"
                                : ""
                        }
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={v =>
                            updateItem(
                                index,
                                "unit_price",
                                v
                            )
                        }
                    />

                    <FormInput
                        label={
                            index === 0
                                ? "Discount %"
                                : ""
                        }
                        type="number"
                        min="0"
                        max="100"
                        value={
                            item.discount_percent
                        }
                        onChange={v =>
                            updateItem(
                                index,
                                "discount_percent",
                                v
                            )
                        }
                    />

                    <FormInput
                        label={
                            index === 0
                                ? "GST %"
                                : ""
                        }
                        type="number"
                        min="0"
                        max="100"
                        value={
                            item.gst_percent
                        }
                        onChange={v =>
                            updateItem(
                                index,
                                "gst_percent",
                                v
                            )
                        }
                    />

                    <button
                        type="button"
                        onClick={() =>
                            removeItem(index)
                        }
                        style={{
                            background: "#dc2626",
                            padding: "10px"
                        }}
                    >
                        X
                    </button>

                </div>

            ))}

            <button
                type="button"
                onClick={addItem}
                style={{
                    width: "auto",
                    background: "#64748b",
                    padding: "9px 15px",
                    marginBottom: "15px"
                }}
            >
                + Add Product
            </button>

            <div
                style={{
                    textAlign: "right",
                    fontSize: "20px",
                    fontWeight: "700",
                    padding: "15px",
                    background: "#f8fafc",
                    borderRadius: "8px"
                }}
            >
                Estimated Grand Total:{" "}
                {`₹${total.toLocaleString("en-IN", {
                    maximumFractionDigits: 2
                })}`}
            </div>

            <p
                style={{
                    fontSize: "12px",
                    color: "#64748b",
                    marginTop: "8px"
                }}
            >
                Final quotation amount is calculated and
                validated by the backend.
            </p>

            <FormButtons
                onClose={onClose}
                onSubmit={() => onSubmit(form)}
                loading={loading}
                text="Create Quotation"
            />

        </Modal>
    );
}



// DISPATCH FORM


function DispatchForm({
    order,
    products,
    onClose,
    onSubmit,
    loading
}) {

    const today =
        new Date().toISOString().split("T")[0];

    const orderItems =
        order.items ||
        order.sales_order_items ||
        [];

    const [form, setForm] = useState({
        dispatch_number: `DIS-${Date.now()}`,
        sales_order_id: order.id,
        dispatch_date: today,
        vehicle_number: "",
        driver_name: "",
        items: orderItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity
        }))
    });

    const update = (field, value) => {
        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const updateItem = (index, field, value) => {

        const items = [...form.items];

        items[index] = {
            ...items[index],
            [field]: value
        };

        setForm(prev => ({
            ...prev,
            items
        }));
    };

    return (
        <Modal
            title={`Dispatch ${order.order_number}`}
            onClose={onClose}
        >

            <FormInput
                label="Dispatch Number"
                value={form.dispatch_number}
                onChange={v =>
                    update(
                        "dispatch_number",
                        v
                    )
                }
            />

            <FormInput
                label="Dispatch Date"
                type="date"
                value={form.dispatch_date}
                onChange={v =>
                    update(
                        "dispatch_date",
                        v
                    )
                }
            />

            <FormInput
                label="Vehicle Number"
                value={form.vehicle_number}
                onChange={v =>
                    update(
                        "vehicle_number",
                        v
                    )
                }
                placeholder="e.g. MH-05-AB-1234"
            />

            <FormInput
                label="Driver Name"
                value={form.driver_name}
                onChange={v =>
                    update(
                        "driver_name",
                        v
                    )
                }
            />

            <h3
                style={{
                    margin: "20px 0 10px"
                }}
            >
                Dispatch Products
            </h3>

            {form.items.map((item, index) => {

                const product = products.find(
                    p =>
                        Number(p.id) ===
                        Number(item.product_id)
                );

                return (
                    <div
                        key={index}
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "1fr 120px",
                            gap: "10px",
                            marginBottom: "10px"
                        }}
                    >

                        <FormInput
                            label="Product"
                            value={
                                product?.product_name ||
                                `Product #${item.product_id}`
                            }
                            disabled
                        />

                        <FormInput
                            label="Quantity"
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={v =>
                                updateItem(
                                    index,
                                    "quantity",
                                    v
                                )
                            }
                        />

                    </div>
                );
            })}

            <div
                style={{
                    background: "#fef3c7",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    marginTop: "15px"
                }}
            >
                Dispatching will decrease both physical
                and reserved inventory.
            </div>

            <FormButtons
                onClose={onClose}
                onSubmit={() => onSubmit(form)}
                loading={loading}
                text="Process Dispatch"
            />

        </Modal>
    );
}



function Modal({
    title,
    children,
    onClose,
    wide = false
}) {

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background:
                    "rgba(15,23,42,.65)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px"
            }}
        >

            <div
                style={{
                    width: wide
                        ? "min(1100px, 96vw)"
                        : "min(600px, 96vw)",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    background: "white",
                    borderRadius: "14px",
                    padding: "28px",
                    boxShadow:
                        "0 25px 60px rgba(0,0,0,.3)"
                }}
            >

                <div
                    style={{
                        display: "flex",
                        justifyContent:
                            "space-between",
                        alignItems: "center",
                        marginBottom: "25px"
                    }}
                >

                    <h2>{title}</h2>

                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            width: "38px",
                            padding: "8px",
                            background: "#e5e7eb",
                            color: "#111827"
                        }}
                    >
                        ×
                    </button>

                </div>

                {children}

            </div>

        </div>
    );
}


function FormInput({
    label,
    value,
    onChange,
    type = "text",
    placeholder = "",
    disabled = false,
    textarea = false,
    min,
    max
}) {

    return (
        <div
            className="form-group"
            style={{ marginBottom: "14px" }}
        >

            {label && <label>{label}</label>}

            {textarea ? (
                <textarea
                    value={value}
                    onChange={e =>
                        onChange(e.target.value)
                    }
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={4}
                    style={{
                        width: "100%",
                        padding: "12px",
                        border:
                            "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontFamily:
                            "Arial, Helvetica, sans-serif",
                        resize: "vertical"
                    }}
                />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={e =>
                        onChange(e.target.value)
                    }
                    placeholder={placeholder}
                    disabled={disabled}
                    min={min}
                    max={max}
                />
            )}

        </div>
    );
}


function FormSelect({
    label,
    value,
    onChange,
    options,
    placeholder
}) {

    return (
        <div
            className="form-group"
            style={{ marginBottom: "14px" }}
        >

            {label && <label>{label}</label>}

            <select
                value={value}
                onChange={e =>
                    onChange(e.target.value)
                }
                style={{
                    width: "100%",
                    padding: "13px 14px",
                    border:
                        "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "15px",
                    background: "white"
                }}
            >

                <option value="">
                    {placeholder ||
                        "Select"}
                </option>

                {options.map(option => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </option>
                ))}

            </select>

        </div>
    );
}




function FormButtons({
    onClose,
    onSubmit,
    loading,
    text
}) {

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px"
            }}
        >

            <button
                type="button"
                onClick={onClose}
                style={{
                    width: "auto",
                    background: "#64748b",
                    padding: "11px 20px"
                }}
            >
                Cancel
            </button>

            <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                style={{
                    width: "auto",
                    padding: "11px 20px"
                }}
            >
                {loading
                    ? "Processing..."
                    : text}
            </button>

        </div>
    );
}




function PageHeader({
    title,
    subtitle,
    button
}) {

    return (
        <div className="topbar">

            <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>

            <div>
                {button}
            </div>

        </div>
    );
}



function UserInfo({ user }) {

    const initials =
        user?.email
            ? user.email
                  .substring(0, 2)
                  .toUpperCase()
            : "U";

    return (
        <div className="user-info">

            <div>
                <strong>
                    {user?.email || "User"}
                </strong>

                <span>
                    {user?.role || "USER"}
                </span>
            </div>

            <div className="user-avatar">
                {initials}
            </div>

        </div>
    );
}



function StatCard({
    icon,
    title,
    value
}) {

    return (
        <div className="stat-card">

            <div className="stat-icon">
                {icon}
            </div>

            <div>
                <p>{title}</p>
                <h2>{value}</h2>
            </div>

        </div>
    );
}



function EmptyRow({
    text,
    columns
}) {

    return (
        <tr>
            <td
                colSpan={columns}
                style={{
                    textAlign: "center",
                    padding: "30px",
                    color: "#64748b"
                }}
            >
                {text}
            </td>
        </tr>
    );
}

export default App;