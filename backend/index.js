import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db_Connection.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3010;

connectDB();

app.get('/', (req, res) => {
    res.send('Hello World!');
});
app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
