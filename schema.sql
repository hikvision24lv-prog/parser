CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_query TEXT,
    min_purchase_price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parse_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id INTEGER,
    seller_name TEXT,
    price REAL,
    position INTEGER,
    FOREIGN KEY(query_id) REFERENCES queries(id)
);
