const express = require('express');
const fs = require('fs').promises;
const Queue = require('./queue'); 

const app = express();
app.use(express.json());
const q = new Queue();
let serverLoggedin = false;
app.get('/', (req, res) => {
    res.send("Bill Payments");
});

app.post('/register', async (req, res) => {
    try {
        const data = await fs.readFile('data.json', 'utf8');
        let parsedData = JSON.parse(data);

        if(parsedData.user.find(element => element.email === req.body.email))
            return res.send({Result:"Account already present"});
        parsedData.user.push(req.body)

        await fs.writeFile('data.json', JSON.stringify(parsedData, null, 2));

        res.send({ Result: "User registered successfully" });
        
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
});
app.post('/login', async (req, res) => {
    try {
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);

        const user = parsedData.user.find(element => element.email === req.body.email);

        if (user) {
            res.send({ user, Result: "Logged in successfully" });
        } else {
            res.send({ Result: "User not found" });
        }
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
});

const deepMerge = (target, source) => {
    for (const key in source) {
        if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], deepMerge(target[key], source[key]));
        }
    }
    return { ...target, ...source };
};

app.put('/updateProfile', async (req, res) => {
    try {
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);

        const index = parsedData.user.findIndex(element => element.email === req.body.email);

        if (index === -1) {
            return res.status(404).send({ Result: "User not found" });
        }

        parsedData.user[index] = deepMerge(parsedData.user[index], req.body);

        await fs.writeFile('data.json', JSON.stringify(parsedData, null, 2));

        res.send({ Result: "User updated successfully" });
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
});

app.get('/getbill', async (req, res) => {
    try {
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);

        const index = parsedData.user.findIndex(element => element.email === req.body.email);

        if (index === -1) {
            return res.status(404).send({ Result: "User not found" });
        }

        const targetUser = parsedData.user[index];
        
        const utilityType = req.body.utilitytype;
        
        if (!targetUser.utility[utilityType]) {
            return res.status(404).send({ Result: "Utility type not found" });
        }

        res.send(targetUser.utility[utilityType]);

    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
});

app.post('/payrequest', async (req, res) => {
    try {
        if(!serverLoggedin)
            return res.send({Result:"Server under maintenance. Please try later"})
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);

        const index = parsedData.user.findIndex(element => element.email === req.body.email);
        console.log(index)
        if (index === -1) {
            return res.status(404).send({ Result: "User not found" });
        }

        const targetUser = parsedData.user[index];
        const utilityType = req.body.utilitytype;

        if (!targetUser.utility[utilityType]) {
            return res.status(404).send({ Result: "Utility type not found" });
        }
        if (targetUser.utility[utilityType].paid) {
            return res.status(404).send({ Result: "Already paid" });
        }

        const payRequest = {
            email: targetUser.email,
            utilityname: req.body.utilitytype,
            utilityType,
            amount: req.body.amount,
            time: new Date().toISOString()
        };

        q.enqueue(payRequest);  // Enqueue request for processing
        res.send({ Result: "Payment request submitted" });
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
});

// Updated /processpayrequest Route
app.post('/processpayrequest', async (req, res) => {
    if(!serverLoggedin)
        return res.send({Result:"Server under maintenance. Please try later"})
    const processedRequest = q.dequeue();

    if (!processedRequest) {
        return res.send({ Result: "No pay requests to process" });
    }
    try {
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);

        const index = parsedData.user.findIndex(element => element.email === processedRequest.email);

        if (index === -1) {
            return res.status(404).send({ Result: "User not found" });
        }
        
        const targetUser = parsedData.user[index];
        
        // Ensure pay_history exists
        if (!targetUser.pay_history) {
            targetUser.pay_history = [];
        }
        targetUser.pay_history.push(processedRequest);
        const utilityname = processedRequest.utilityname
        parsedData.user[index].utility.utilityType.paid = true
        await fs.writeFile('data.json', JSON.stringify(parsedData, null, 2));
        
        res.send({ processedRequest, Result: "Payment request processed" });
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error processing the payment request" });
    }
});

app.get('/serverlogin',async(req, res)=>{
    try {
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);

        q.queue = [...parsedData.payRequests, ...q.queue]
        res.send({ Result: "Server logged in" });
        serverLoggedin = true
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error updating the file" });
    }
})

app.get('/serverlogout',async(req, res)=>{
    try {
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);
        parsedData.payRequests = q.queue
        await fs.writeFile('data.json', JSON.stringify(parsedData, null, 2));
        res.send({ Result: "Server logged out" });
        serverLoggedin = false
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
})

app.post('/updateBill', async (req, res) => {
    try {
        const data = await fs.readFile('data.json', 'utf8');
        let parsedData = JSON.parse(data);

        const index = parsedData.user.findIndex(element => element.email === req.body.email);
        if (index === -1) return res.status(404).send({ Result: "User not found" });

        const utilityType = req.body.utilitytype;
        if (!parsedData.user[index].utility[utilityType]) {
            return res.status(404).send({ Result: "Utility type not found" });
        }

        parsedData.user[index].utility[utilityType].amount = req.body.amount;
        parsedData.user[index].utility[utilityType].paid = false;

        await fs.writeFile('data.json', JSON.stringify(parsedData, null, 2));
        res.send({ Result: "Bill amount set" });
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
});

app.get('/payhistory', async (req, res) => {
    try {
        const data = await fs.readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);

        const user = parsedData.user.find(element => element.email === req.body.email);
        if (!user) return res.status(404).send({ Result: "User not found" });

        const payHistory = user.pay_history || [];
        res.send({ payHistory });
    } catch (err) {
        console.error("Error reading or parsing the file:", err);
        res.status(500).send({ Result: "Error reading the file" });
    }
});
app.listen(5000, () => {
    console.log("Running on port 5000");
});
