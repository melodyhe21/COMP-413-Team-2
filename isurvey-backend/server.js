const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require("bcryptjs");
//const fetch = require('node-fetch')
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Register new user
app.post("/register", async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const hashed = await bcrypt.hash(password, 10);

        const existingUser = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const newUser = await pool.query(
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *",
            [username, hashed, role]
        );

        res.json(newUser.rows[0]);
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// Login user
app.post("/login", async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const userRes = await pool.query("SELECT * FROM users WHERE username = $1 AND role = $2", [username, role]);
        if (userRes.rows.length === 0) {
            return res.status(400).json({ error: "Invalid username or role" });
        }

        const user = userRes.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: "Incorrect password" });
        }

        res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed" });
    }
});


app.get('/users', async (req, res) => {
    try {
        const users = await pool.query("SELECT * FROM users");
        res.json(users.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching users." });
    }
});

app.delete('/users', async (req, res) => {
    try {
        await pool.query('DELETE FROM users');
        res.status(200).json({ message: 'All users deleted.' });
    } catch (err) {
        console.error('Error deleting users:', err.message);
        res.status(500).json({ error: 'Failed to delete users.' });
    }
});


app.post('/surveys', async (req, res) => {
    try {
        const { title, description, created_by } = req.body;

        const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [created_by]);
        if (userCheck.rows.length === 0) {
            return res.status(400).json({ error: "User ID does not exist." });
        }

        const newSurvey = await pool.query(
            "INSERT INTO surveys (title, description, created_by) VALUES ($1, $2, $3) RETURNING *",
            [title, description, created_by]
        );

        res.json(newSurvey.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while creating survey." });
    }
});


app.get('/surveys/:survey_id/responses', async (req, res) => {
    try {
        const { survey_id } = req.params;

        const surveyCheck = await pool.query("SELECT * FROM surveys WHERE id = $1", [survey_id]);
        if (surveyCheck.rows.length === 0) {
            return res.status(400).json({ error: "Survey ID does not exist." });
        }

        const query = `
            SELECT 
                q.id AS question_id,
                q.question_text,
                r.id AS response_id,
                r.response_text,
                u.id AS user_id,
                u.username
            FROM responses r
            JOIN questions q ON q.id = r.question_id
            JOIN users u ON u.id = r.user_id
            WHERE r.survey_id = $1
            ORDER BY q.id;
        `;
        const result = await pool.query(query, [survey_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "No responses found for this survey." });
        }

        const responsesByQuestion = {};
        for (const row of result.rows) {
            const { question_id, question_text, response_id, response_text, user_id, username } = row;
            
            if (!responsesByQuestion[question_id]) {
                responsesByQuestion[question_id] = {
                    question_id,
                    question_text,
                    answers: []
                };
            }

            responsesByQuestion[question_id].answers.push({
                response_id,
                response_text,
                user_id,
                username
            });
        }

        
        const groupedResults = Object.values(responsesByQuestion);
        res.json(groupedResults);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching survey responses." });
    }
});

app.get('/surveys/:survey_id', async (req, res) => {
    try {
        const { survey_id } = req.params;
        const surveys = await pool.query("SELECT * FROM surveys WHERE id = $1", [survey_id]);
        if (surveys.rows.length === 0) {
            return res.status(400).json({ error: "Survey ID does not exist." });
        }

        
        res.json(surveys.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching surveys." });
    }
})

app.get('/surveys', async (req, res) => {
    try {
        const surveys = await pool.query("SELECT * FROM surveys");
        res.json(surveys.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching surveys." });
    }
});



app.post('/questions', async (req, res) => {
    try {
        const { survey_id, question_text, question_type, options, image_url } = req.body;

        const surveyCheck = await pool.query("SELECT * FROM surveys WHERE id = $1", [survey_id]);
        if (surveyCheck.rows.length === 0) {
            return res.status(400).json({ error: "Survey ID does not exist." });
        }

        const newQuestion = await pool.query(
        `INSERT INTO questions (survey_id, question_text, question_type, options, image_url)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [survey_id, question_text, question_type, options || null, image_url || null]
        );

        res.json(newQuestion.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while creating question." });
    }
});

app.get('/questions', async (req, res) => {
    try {
        const questions = await pool.query("SELECT * FROM questions");
        res.json(questions.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching questions." });
    }
});

app.get('/surveys/:survey_id/questions', async (req, res) => {
    try {
        const { survey_id } = req.params;

        const surveyCheck = await pool.query("SELECT * FROM surveys WHERE id = $1", [survey_id]);
        if (surveyCheck.rows.length === 0) {
            return res.status(400).json({ error: "Survey ID does not exist." });
        }

        const questions = await pool.query(
            "SELECT * FROM questions WHERE survey_id = $1", 
            [survey_id]
        );

        if (questions.rows.length === 0) {
            return res.status(404).json({ error: "No questions found for this survey." });
        }

        res.json(questions.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching questions." });
    }
});

app.post('/responses', async (req, res) => {
    try {
        const { survey_id, user_id, question_id, response_text } = req.body;

        const surveyCheck = await pool.query("SELECT * FROM surveys WHERE id = $1", [survey_id]);
        if (surveyCheck.rows.length === 0) {
            return res.status(400).json({ error: "Survey ID does not exist." });
        }

        const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);
        if (userCheck.rows.length === 0) {
            return res.status(400).json({ error: "User ID does not exist." });
        }

        const questionCheck = await pool.query("SELECT * FROM questions WHERE id = $1", [question_id]);
        if (questionCheck.rows.length === 0) {
            return res.status(400).json({ error: "Question ID does not exist." });
        }

        const newResponse = await pool.query(
            "INSERT INTO responses (survey_id, user_id, question_id, response_text) VALUES ($1, $2, $3, $4) RETURNING *",
            [survey_id, user_id, question_id, response_text]
        );

        res.json(newResponse.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while submitting response." });
    }
});

app.get('/responses', async (req, res) => {
    try {
        const { survey_id, user_id, question_id } = req.query;

        let query = 'SELECT * FROM responses WHERE 1=1';
        const values = [];

        if (survey_id) {
            values.push(survey_id);
            query += ` AND survey_id = $${values.length}`;
        }

        if (user_id) {
            values.push(user_id);
            query += ` AND user_id = $${values.length}`;
        }

        if (question_id) {
            values.push(question_id);
            query += ` AND question_id = $${values.length}`;
        }

        const result = await pool.query(query, values);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching responses:", err.message);
        res.status(500).json({ error: "Failed to fetch responses" });
    }
});

app.delete('/responses', async (req, res) => {
    try {
        const { survey_id, user_id, question_id } = req.query;

        if (!survey_id) {
            return res.status(400).json({ error: "survey_id is required to delete responses." });
        }

        let query = 'DELETE FROM responses WHERE survey_id = $1';
        const values = [survey_id];

        if (user_id) {
            values.push(user_id);
            query += ` AND user_id = $${values.length}`;
        }

        if (question_id) {
            values.push(question_id);
            query += ` AND question_id = $${values.length}`;
        }

        const result = await pool.query(query + ' RETURNING *', values);
        res.json({
            message: `Deleted ${result.rowCount} response(s).`,
            deleted: result.rows
        });
    } catch (err) {
        console.error("Error deleting responses:", err.message);
        res.status(500).json({ error: "Failed to delete responses." });
    }
});

app.get('/responses/:survey_id', async (req, res) => {
    try {
        const { survey_id } = req.params;

        const surveyCheck = await pool.query("SELECT * FROM surveys WHERE id = $1", [survey_id]);
        if (surveyCheck.rows.length === 0) {
            return res.status(400).json({ error: "Survey ID does not exist." });
        }

        const responses = await pool.query(
            "SELECT * FROM responses WHERE survey_id = $1",
            [survey_id]
        );

        if (responses.rows.length === 0) {
            return res.status(404).json({ error: "No responses found for this survey." });
        }

        res.json(responses.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching responses." });
    }
});

app.get('/isic-images', async (req, res) => {
    try {
        let allImages = [];
        let cursor = null;
        const limit = 100;
        let apiUrl = `https://api.isic-archive.com/api/v2/images?limit=${limit}`;
        let i = 0;
        while (i < 20) { // 2000 images
            const response = await fetch(apiUrl, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`ISIC API error: ${response.statusText}`);
            }

            const data = await response.json();
            allImages = [...allImages, ...data.results];
            apiUrl = data.next;
            if (!apiUrl) break;
            i++;
        }

        res.json({ results: allImages });
    } catch (error) {
        console.error('Error fetching ISIC images:', error.message);
        res.status(500).json({ error: 'Failed to fetch ISIC images.' });
    }
});

app.post('/survey-assignments', async (req, res) => {
    try {
        const { survey_id, user_id } = req.body;

        const survey = await pool.query("SELECT * FROM surveys WHERE id = $1", [survey_id]);
        const doctor = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'doctor'", [user_id]);

        if (survey.rows.length === 0) {
            return res.status(404).json({ error: "Survey not found." });
        }

        if (doctor.rows.length === 0) {
            return res.status(404).json({ error: "Doctor not found or is not a doctor." });
        }

        const assignment = await pool.query(
            "INSERT INTO survey_assignments (survey_id, user_id) VALUES ($1, $2) RETURNING *",
            [survey_id, user_id]
        );

        res.json(assignment.rows[0]);
    } catch (err) {
        console.error("Error assigning survey:", err.message);
        res.status(500).json({ error: "Server error while assigning survey." });
    }
});

app.get('/survey-assignments/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const result = await pool.query(`
            SELECT s.* 
            FROM surveys s
            INNER JOIN survey_assignments sa ON sa.survey_id = s.id
            WHERE sa.user_id = $1
        `, [user_id]);

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching assigned surveys:", err.message);
        res.status(500).json({ error: "Server error while fetching assigned surveys." });
    }
});

app.post('/survey-assignments/username', async (req, res) => {
    try {
        const { survey_id, username } = req.body;

        if (!survey_id || !username) {
            return res.status(400).json({ error: "survey_id and username are required." });
        }

        const doctorResult = await pool.query(
            "SELECT id FROM users WHERE username = $1 AND role = 'doctor'",
            [username]
        );

        if (doctorResult.rows.length === 0) {
            return res.status(404).json({ error: "Doctor not found or not a doctor." });
        }

        const user_id = doctorResult.rows[0].id;

        const survey = await pool.query("SELECT id FROM surveys WHERE id = $1", [survey_id]);
        if (survey.rows.length === 0) {
            return res.status(404).json({ error: "Survey not found." });
        }

        const assignment = await pool.query(
            "INSERT INTO survey_assignments (survey_id, user_id) VALUES ($1, $2) RETURNING *",
            [survey_id, user_id]
        );

        res.json(assignment.rows[0]);
    } catch (err) {
        console.error("Error assigning survey:", err.message);
        res.status(500).json({ error: "Server error while assigning survey." });
    }
});

app.post('/gaze_data', async (req, res) => {
    try {
        const {
            user_id,
            survey_id,
            question_id,
            image_width,
            image_height,
            gaze_x,
            gaze_y,
            timestamp
        } = req.body;

        const query = `
            INSERT INTO gaze_data (
                user_id, survey_id, question_id,
                image_width, image_height, gaze_x, gaze_y, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;

        const values = [
            user_id,
            survey_id,
            question_id,
            image_width,
            image_height,
            gaze_x,
            gaze_y,
            timestamp
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
        console.log("Gaze data successfully received:", req.body);
    } catch (err) {
        console.error("Error inserting gaze data:", err.message);
        res.status(500).json({ error: "Failed to store gaze data" });
    }
});

app.get('/gaze_data', async (req, res) => {
    try {
        const { survey_id, user_id, question_id } = req.query;

        let query = 'SELECT * FROM gaze_data WHERE 1=1';
        const values = [];

        if (survey_id) {
            values.push(survey_id);
            query += ` AND survey_id = $${values.length}`;
        }

        if (user_id) {
            values.push(user_id);
            query += ` AND user_id = $${values.length}`;
        }

        if (question_id) {
            values.push(question_id);
            query += ` AND question_id = $${values.length}`;
        }

        const result = await pool.query(query, values);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching gaze data:", err.message);
        res.status(500).json({ error: "Failed to fetch gaze data" });
    }
});

app.delete('/gaze_data', async (req, res) => {
    try {
        const { survey_id, user_id, question_id } = req.query;

        if (!survey_id) {
            return res.status(400).json({ error: "survey_id is required to delete gaze data." });
        }

        let query = 'DELETE FROM gaze_data WHERE survey_id = $1';
        const values = [survey_id];

        if (user_id) {
            values.push(user_id);
            query += ` AND user_id = $${values.length}`;
        }

        if (question_id) {
            values.push(question_id);
            query += ` AND question_id = $${values.length}`;
        }

        const result = await pool.query(query + ' RETURNING *', values);
        res.json({
            message: `Deleted ${result.rowCount} gaze data point(s).`,
            deleted: result.rows
        });
    } catch (err) {
        console.error("Error deleting gaze data:", err.message);
        res.status(500).json({ error: "Failed to delete gaze data." });
    }
});


app.delete('/surveys/:survey_id', async (req, res) => {
    try {
        const { survey_id } = req.params;

        const surveyCheck = await pool.query('SELECT * FROM surveys WHERE id = $1', [survey_id]);
        if (surveyCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Survey not found.' });
        }


        const deleteResult = await pool.query(
            'DELETE FROM surveys WHERE id = $1 RETURNING *',
            [survey_id]
        );

        res.json({
            message: 'Survey successfully deleted',
            deletedSurvey: deleteResult.rows[0]
        });
    } catch (err) {
        console.error('Error deleting survey:', err.message);
        res.status(500).json({ error: 'Server error while deleting survey.' });
    }
});

app.post('/classifications', async (req, res) => {
    const { user_id, survey_id, result } = req.body;
  
    try {
      const query = `
        INSERT INTO classification (user_id, survey_id, result)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const values = [user_id, survey_id, result];
  
      const { rows } = await pool.query(query, values);
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Error inserting classification:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get('/classifications', async (req, res) => {
    const { user_id, survey_id } = req.query;
  
    try {
      let query = 'SELECT * FROM classification';
      const values = [];
      const conditions = [];
  
      if (user_id) {
        values.push(user_id);
        conditions.push(`user_id = $${values.length}`);
      }
      if (survey_id) {
        values.push(survey_id);
        conditions.push(`survey_id = $${values.length}`);
      }
  
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
  
      const { rows } = await pool.query(query, values);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching classifications:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
