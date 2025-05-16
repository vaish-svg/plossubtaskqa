const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

// Initialize the app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());  // To parse JSON bodies

// MySQL connection setup for the first DB
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',  // Hardcoded password for plos_keytask_ready DB
  database: 'plos_keytask_ready'  // Database name
});

// MySQL connection setup for the second DB
const dbUsers = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',  // Hardcoded password for pkreports DB
  database: 'pkreports'  // Database name
});

// Connect to MySQL - plos_keytask_ready
db.connect((err) => {
  if (err) {
    console.error('Error connecting to plos_keytask_ready DB:', err);
    return;
  }
  console.log('Connected to plos_keytask_ready DB');
});

// Connect to MySQL - pkreports
dbUsers.connect((err) => {
  if (err) {
    console.error('Error connecting to pkreports DB:', err);
    return;
  }
  console.log('Connected to pkreports DB');
});
app.get('/api/data', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM plos_key_tasks';
  let params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching data from plos_keytask_ready DB:', err);
      return res.status(500).send('Error fetching data');
    }

    // When filtering by "completed", just return as a separate key
    if (status === 'completed') {
      return res.json({ completed: results });
    }

    // Default grouping logic
    const groupedData = {
      completed: [],
      readyForProofGeneration: [],
      proofGeneration: [],
      finalProofComposition: [],
    };
    
    results.forEach(row => {
      if (row.status === 'completed') {
        groupedData.completed.push(row);
      } else {
        const taskName = row.taskName?.toLowerCase() || '';
    
        if (taskName.includes('proof generation - latex') || taskName.includes('msc latex')) {
          groupedData.readyForProofGeneration.push(row);
        } else if (taskName.includes('proof generation')) {
          groupedData.proofGeneration.push(row);
        } else if (taskName.includes('final proof composition')) {
          groupedData.finalProofComposition.push(row);
        }
      }
    });
    
    res.json(groupedData);
      });
});


// Define a route for login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // Check if password matches the hardcoded one
  if (password !== 'Plos@123') {
    return res.status(401).json({ message: 'Invalid password' });
  }

  // Check if the user exists in pkreports DB
  const sql = 'SELECT * FROM users WHERE email = ?';
  dbUsers.query(sql, [email], (err, results) => {
    if (err) {
      console.error('Error querying pkreports DB:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Login successful', user: results[0] });
  });
});
app.post('/api/update-task', (req, res) => {
  const { proofDeliveryStatus, submittedBy, submittedDate, id } = req.body;

  if (!submittedBy) {
    return res.status(400).json({ message: 'Email of the submitter is required' });
  }

  const formattedDate = new Date(submittedDate)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' '); // MySQL format

  const status = 'completed'; // Force status to 'completed'

  const sql = `
  UPDATE plos_key_tasks
  SET 
    proofDeliveryStatus = ?, 
    submittedBy = ?, 
    submittedDate = ?, 
    status = ?
  WHERE id = ?
`;

  db.query(sql, [proofDeliveryStatus, submittedBy, formattedDate, status, id], (err, result) => {
    if (err) {
      console.error("Error updating row:", err);
      return res.status(500).send(err);
    }

    res.send({ success: true, message: 'Task updated and marked as completed' });
  });
});


// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend is running on http://localhost:${PORT}`);
});