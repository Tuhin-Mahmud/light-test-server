const express = require('express')
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;


// middle ware 
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tpqoiya.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const usersCollection = client.db('lightTest').collection('user')
        const menuCollection = client.db('lightTest').collection('menu')
        const cartCollection = client.db('lightTest').collection('carts')
        const reviewsCollection = client.db('lightTest').collection('reviews')

        // jwt related api

        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' })
            res.send({ token })
        })

        // 1. verifyToken
        const verifyToken = async (req, res, next) => {
            // console.log('request token in backend from client  site:', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            console.log('token paiche', token);

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                console.log(decoded.email);
                if (err) {
                    console.log('errrorrrr:', err);
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next()
            })

        }

        // chaking  admin 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const admin = user?.role === 'admin';
            if (!admin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()

        }



        // user collection related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            // console.log(req.headers);
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        // admin api 
        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let isAdmin = false;
            if (user) {
                isAdmin = user?.role === 'admin'
            }
            res.send({ isAdmin })
        })



        // --------------
        app.post('/create-users', async (req, res) => {
            const user = req.body;
            const email = user.email;
            const query = { email: email }
            const existing = await usersCollection.findOne(query)
            if (existing) {
                return res.send({ message: 'user already exists' })
            }
            // console.log(user);
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.patch('/user/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }

            }
            const result = await usersCollection.updateOne(query, updatedDoc)
            res.send(result)
        })


        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        // cart collection related api
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem)
            res.send(result)
        })


        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })

        // menu collection related api
        app.get('/api/v1/menu-read', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.findOne(query)
            res.send(result)
        })

        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            console.log(item);
            const result = await menuCollection.insertOne(item)
            res.send(result)
        })


        app.patch('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const item = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: item.name,
                    image: item.image,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe
                }
            }
            const result = await menuCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.delete('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        })



        // reviews data
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })

        // payment related api
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('LIGHT TEST RESTAURANTS IS RUNNING! ')
})

app.listen(port, () => {
    console.log(`restaurants is listening on port: ${port}`)
})   
