import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { time } from 'console';

const app = express();

//Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: String,
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

app.use(cors());

app.get('/', (req, res) => {
//   res.send('Hello World!');
    return res.json({ message: 'Hello World!' });
});

app.post('/upload', multer().single('pdf'), (req, res) => {
    return res.json({message: 'Received'});
});

app.listen(3000, () => console.log('Server running on port 3000'));