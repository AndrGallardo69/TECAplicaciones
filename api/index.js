const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const server = express();
server.use(cors());
server.use(express.json());

// Configuración de conexión (Él debe poner sus propias variables en Vercel)
const clientConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "4000"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
};

let connectionPool;
async function connectDB() {
  if (!connectionPool) connectionPool = mysql.createPool(clientConfig);
  return connectionPool;
}

// Inicialización de módulos
server.get("/api/health", async (req, res) => {
  try {
    const db = await connectDB();
    const tables = [
      "CREATE TABLE IF NOT EXISTS conceptos (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100), descripcion TEXT)",
      "CREATE TABLE IF NOT EXISTS destinos (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100), responsable VARCHAR(100))",
      "CREATE TABLE IF NOT EXISTS productos (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100), precio DECIMAL(10,2))",
      "CREATE TABLE IF NOT EXISTS unidades (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100), abreviatura VARCHAR(10))"
    ];
    for (let sql of tables) { await db.execute(sql); }
    res.json({ status: "online" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lógica de Rutas Dinámicas
const modules = [
  { path: "conceptos", table: "conceptos", cols: ["nombre", "descripcion"] },
  { path: "destinos", table: "destinos", cols: ["nombre", "responsable"] },
  { path: "productos", table: "productos", cols: ["nombre", "precio"] },
  { path: "unidades", table: "unidades", cols: ["nombre", "abreviatura"] }
];

modules.forEach(m => {
  // Obtener datos
  server.get(`/api/${m.path}`, async (req, res) => {
    try {
      const db = await connectDB();
      const [data] = await db.execute(`SELECT * FROM ${m.table} ORDER BY id DESC`);
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Guardar datos
  server.post(`/api/${m.path}`, async (req, res) => {
    try {
      const db = await connectDB();
      const fields = m.cols.join(",");
      const marks = m.cols.map(() => "?").join(",");
      const vals = m.cols.map(c => req.body[c]);
      await db.execute(`INSERT INTO ${m.table} (${fields}) VALUES (${marks})`, vals);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Borrar datos
  server.delete(`/api/${m.path}/:id`, async (req, res) => {
    try {
      const db = await connectDB();
      await db.execute(`DELETE FROM ${m.table} WHERE id = ?`, [req.params.id]);
      res.json({ deleted: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

module.exports = server;