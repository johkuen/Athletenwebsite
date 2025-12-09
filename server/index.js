require('dotenv').config(); // .env zuerst laden!

console.log('Pfad:', __dirname);
console.log('DATABASE_URL:', process.env.DATABASE_URL);


const db = require('./db');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Damit Bilder aus /public/images/ ausgeliefert werden

// Test-Route für die DB-Verbindung
app.get('/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    console.error('Fehler bei DB-Test:', err);
    res.status(500).json({ error: err.message });
  }
});

// Registrierung: POST /api/register
app.post('/api/register', async (req, res) => {
  const { vorname, nachname, email, password } = req.body;
  if (!vorname || !nachname || !email || !password) {
    return res.status(400).json({ error: 'Vorname, Nachname, Email und Passwort sind erforderlich.' });
  }
  try {
    // Prüfe, ob User schon existiert
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'E-Mail ist bereits registriert.' });
    }
    // Passwort hashen
    const hash = await bcrypt.hash(password, 10);

    // Bild-URL automatisch nach Schema setzen (optional)
    const bild_url = `/images/${nachname.toLowerCase()}-${vorname.toLowerCase()}_2026.jpg`;

    // User anlegen
    await db.query(
      'INSERT INTO users (vorname, nachname, email, password_hash, bild_url) VALUES ($1, $2, $3, $4, $5)',
      [vorname, nachname, email, hash, bild_url]
    );
    res.json({ message: 'Registrierung erfolgreich!' });
  } catch (err) {
    console.error('Fehler bei Registrierung:', err);
    res.status(500).json({ error: 'Serverfehler bei der Registrierung.' });
  }
});

// Login: POST /api/login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }
  try {
    // Nutzer suchen
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort.' });
    }
    const user = result.rows[0];
    // Passwort prüfen
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort.' });
    }
    // JWT erstellen
    const token = jwt.sign(
      { id: user.id, email: user.email, vorname: user.vorname, nachname: user.nachname, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        vorname: user.vorname,
        nachname: user.nachname,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Fehler beim Login:', err);
    res.status(500).json({ error: 'Serverfehler beim Login.' });
  }
});

// Ergebnis anlegen: POST /api/results
app.post('/api/results', async (req, res) => {
  const { user_id, datum, art, wert, kommentar, wettkampf } = req.body;
  if (!user_id || !datum || !art || !wert) {
    return res.status(400).json({ error: 'user_id, datum, art und wert sind erforderlich.' });
  }
  try {
    await db.query(
      'INSERT INTO results (user_id, datum, art, wert, kommentar, wettkampf) VALUES ($1, $2, $3, $4, $5, $6)',
      [user_id, datum, art, wert, kommentar, wettkampf]
    );
    res.json({ message: 'Ergebnis gespeichert!' });
  } catch (err) {
    console.error('Fehler beim Speichern:', err);
    res.status(500).json({ error: 'Serverfehler beim Speichern.' });
  }
});

// Ergebnisse eines Nutzers abrufen: GET /api/results/:user_id?limit=5
app.get('/api/results/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { type, limit } = req.query;
  let query = 'SELECT id, datum, wert, kommentar, wettkampf, art FROM results WHERE user_id = $1';
  let params = [user_id];
  if (type) {
    query += ' AND art = $2';
    params.push(type);
  }
  query += ' ORDER BY datum DESC';
  if (limit) query += ` LIMIT ${parseInt(limit, 10)}`;
  const result = await db.query(query, params);
  res.json(result.rows);
});

app.get('/api/wettkaempfe', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM wettkaempfe ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen der Wettkämpfe:', err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Wettkämpfe.' });
  }
});

// Modernisierte User-API
app.get('/api/user/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, vorname, nachname, email, geburtsdatum, wohnort, kaderstatus, bild_url FROM users WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Userdaten.' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
