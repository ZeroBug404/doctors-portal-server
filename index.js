const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
var jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const { request } = require("express");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pyeyw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//JWT
function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const appointmentCollection = client
      .db("doctors")
      .collection("appointment");
    const bookingCollection = client.db("doctors").collection("booking");
    const userCollection = client.db("doctors").collection("users");
    const doctorsCollection = client.db("doctors").collection("doctors");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const reqesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (reqesterAccount.role === "admin") {
        next();
      }
      else{
        res.status(403).send({message: 'Forbidden acccess'})
      }
    }

    /**
     * API Naming Convention
     * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
     * app.get('/booking/:id') // get a specific booking 
     * app.post('/booking') // add a new booking
     * app.patch('/booking/:id) //
     * app.put('/booking/:id') // upsert ==> update (if exists) or insert (if doesn't exist)
     * app.delete('/booking/:id) //
    */

    app.get("/appointment", async (req, res) => {
      const query = {};
      const cursor = appointmentCollection.find(query).project({name: 1});
      const appointments = await cursor.toArray();
      res.send(appointments);
    });

    //get all users for dashboard
    app.get("/users", verifyJwt, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.post("/booking", async (req, res) => {
      const bookingInfo = req.body;
      const query = {
        treatmentName: bookingInfo.treatmentName,
        date: bookingInfo.date,
        patientEmail: bookingInfo.patientEmail,
      };
      const filter = await bookingCollection.findOne(query);
      if (filter) {
        return res.send({ success: false, booking: filter });
      }
      const result = await bookingCollection.insertOne(bookingInfo);
      return res.send({ success: true, result });
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date;

      //step 1: get all appointments
      const appointments = await appointmentCollection.find().toArray();

      //step 2: get the bookings of that day output: [{}, {}, {},{}, {}, {}]
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      //step 3: for each appointment
      appointments.forEach((appointment) => {
        //step 4: find bookings for that appointment. output: [{}, {}, {}]
        const appointmentBookings = bookings.filter(
          (book) => book.treatmentName === appointment.name
        );

        //step 5: select the slots for the appointment bookings.
        const bookedSlots = appointmentBookings.map((book) => book.slot);

        // step 6: select those slots that are not in bookedSlots
        const available = appointment.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        //step 7: set available to slots to make it easier
        appointment.slots = available;
      });

      res.send(appointments);
    });

    // my bookings in dashboard
    app.get("/booking", verifyJwt, async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const decodedEmail = req.decoded.email;
      if (patientEmail === decodedEmail) {
        const query = { patientEmail: patientEmail };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "Forbifidden access" });
      }
    });

    //api for users
    app.put("/users/admin/:email", verifyJwt, verifyAdmin,  async (req, res) => {
      const email = req.params.email;
      // const requester = req.decoded.email;
      // const reqesterAccount = await userCollection.findOne({
      //   email: requester,
      // });

        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);

        res.status(403).send({message: 'Forbidden acccess'})
      
    });

    app.get('/admin/:email', async(req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin})
    })

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const users = req.body;
      const updateDoc = {
        $set: users,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    //api for doctors
    app.get('/doctors', verifyJwt, verifyAdmin, async(req, res) => {
      const doctors = await doctorsCollection.find().toArray();
      res.send(doctors);
    })

    app.post('/doctors', verifyJwt, verifyAdmin, async(req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    })

    app.delete('/doctors/:email', verifyJwt, verifyAdmin, async(req, res) => {
      const email = req.params.email;
      const filter = {email: email};
      const deleteDoctor = await doctorsCollection.deleteOne(filter)
      res.send(deleteDoctor);
    })
  } catch {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Doctors portal on port ${port}`);
});
