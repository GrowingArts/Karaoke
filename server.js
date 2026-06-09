const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ytdl = require('ytdl-core'); // Open-source βιβλιοθήκη για κατέβασμα από YT

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // Σερβίρει το index.html από τον φάκελο public

// Endpoint για την επεξεργασία του YouTube Link
app.post('/api/process-youtube', async (req, res) => {
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) return res.status(400).json({ error: 'Missing YouTube URL' });

    const outputId = Date.now();
    const inputAudioPath = path.join(__dirname, `input_${outputId}.mp3`);
    const outputFolder = path.join(__dirname, `output_${outputId}`);

    try {
        console.log(`1. Κατέβασμα ήχου από: ${youtubeUrl}`);
        // Κατεβάζουμε μόνο τον ήχο απευθείας από το YouTube
        const stream = ytdl(youtubeUrl, { quality: 'highestaudio' });
        const fileStream = fs.createWriteStream(inputAudioPath);
        
        stream.pipe(fileStream);

        fileStream.on('finish', () => {
            console.log('2. Το κατέβασμα τελείωσε. Έναρξη AI φωνητικού διαχωρισμού...');
            
            // Κλήση του open-source Spleeter μέσω Command Line
            // Χωρίζει το κομμάτι σε 2 stems (vocals.wav και instrumental.wav)
            exec(`spleeter separate -p spleeter:2stems -o ${outputFolder} ${inputAudioPath}`, (error, stdout, stderr) => {
                if (error) {
                    console.error('AI Error:', error);
                    return res.status(500).json({ error: 'AI processing failed' });
                }

                // Το Spleeter δημιουργεί έναν υποφάκελο με το όνομα του αρχείου εισόδου
                const finalInstrumentalPath = path.join(outputFolder, `input_${outputId}`, 'instrumental.wav');
                
                if (fs.existsSync(finalInstrumentalPath)) {
                    console.log('🚀 Επιτυχία! Το Instrumental είναι έτοιμο.');
                    
                    // Στέλνουμε το αρχείο ήχου πίσω στο frontend
                    res.sendFile(finalInstrumentalPath, () => {
                        // Καθαρισμός προσωρινών αρχείων από τον server για να μην γεμίσει ο δίσκος
                        fs.unlinkSync(inputAudioPath);
                        fs.rmSync(outputFolder, { recursive: true, force: true });
                    });
                } else {
                    res.status(500).json({ error: 'Instrumental file not found' });
                }
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
