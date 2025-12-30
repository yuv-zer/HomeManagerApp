const { Connection, Request, TYPES } = require('tedious');

// Database configuration using Environment Variables for security
const config = {
    server: process.env.AZURE_SQL_SERVER, 
    authentication: {
        type: 'default',
        options: {
            userName: process.env.AZURE_SQL_USERNAME,
            password: process.env.AZURE_SQL_PASSWORD,
        }
    },
    options: {
        database: process.env.AZURE_SQL_DATABASE,
        encrypt: true,
        trustServerCertificate: false,
        rowCollectionOnRequestCompletion: true
    }
};

module.exports = async function (context, req) {
    // 1. Extract User Identity from Azure Static Web Apps Auth header
    const header = req.headers['x-ms-client-principal'];
    if (!header) {
        context.res = { status: 401, body: "Unauthorized: No auth header found." };
        return;
    }

    // Decode base64 header to get user details
    const encoded = Buffer.from(header, 'base64');
    const decoded = JSON.parse(encoded.toString('ascii'));
    const userEmail = decoded.userDetails; // This is the 'UserId' used in your RLS policy

    return new Promise((resolve, reject) => {
        const connection = new Connection(config);

        connection.on('connect', (err) => {
            if (err) {
                context.log.error('Database connection failed:', err);
                context.res = { status: 500, body: "Error connecting to database." };
                resolve();
                return;
            }

            // 2. Set Session Context for RLS
            // This ensures the current connection is tagged with the user's email
            const setContextRequest = new Request(
                "EXEC sp_set_session_context @key=N'UserId', @value=@userEmail",
                (err) => {
                    if (err) {
                        context.log.error('Failed to set session context:', err);
                        context.res = { status: 500, body: "Security context error." };
                        connection.close();
                        resolve();
                    } else {
                        // 3. Context set successfully, now fetch expenses
                        fetchExpenses();
                    }
                }
            );

            setContextRequest.addParameter('userEmail', TYPES.NVarChar, userEmail);
            connection.execSql(setContextRequest);
        });

        const fetchExpenses = () => {
            // Because RLS is active, this simple SELECT only returns rows where UserId = userEmail
            const query = "SELECT id, amount, category, description, expense_date FROM Expenses ORDER BY expense_date DESC";
            
            const request = new Request(query, (err, rowCount, rows) => {
                if (err) {
                    context.log.error('Query failed:', err);
                    context.res = { status: 500, body: "Error retrieving data." };
                } else {
                    // Map Tedious row format to clean JSON objects
                    const expenses = rows.map(row => {
                        const expense = {};
                        row.forEach(column => {
                            expense[column.metadata.colName] = column.value;
                        });
                        return expense;
                    });

                    context.res = {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: expenses
                    };
                }
                connection.close();
                resolve();
            });

            connection.execSql(request);
        };

        connection.connect();
    });
};