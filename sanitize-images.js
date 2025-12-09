const { Client } = require('pg');

// PostgreSQL-Verbindung konfigurieren (bitte anpassen)
const client = new Client({
  connectionString: process.env.DATABASE_URL, // oder feste URL hier eintragen
});

function sanitizeFilename(filename) {
  if (!filename) return filename;
  // Umlaute ersetzen
  let clean = filename
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Akzente entfernen
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue');
  // Leerzeichen entfernen
  clean = clean.replace(/\s+/g, '');
  return clean;
}

async function updateBildUrl() {
  try {
    await client.connect();

    // Alle Nutzer mit Bild-URLs laden
    const res = await client.query('SELECT id, bild_url FROM users WHERE bild_url IS NOT NULL');

    for (const row of res.rows) {
      const original = row.bild_url;
      const sanitized = sanitizeFilename(original);

      if (original !== sanitized) {
        console.log(`Update user ${row.id}: "${original}" -> "${sanitized}"`);
        await client.query('UPDATE users SET bild_url = $1 WHERE id = $2', [sanitized, row.id]);
      }
    }

    console.log('Bereinigung der Bild-URLs abgeschlossen.');
  } catch (err) {
    console.error('Fehler:', err);
  } finally {
    await client.end();
  }
}

updateBildUrl();
