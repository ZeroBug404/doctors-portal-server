const express = require('express');
const cors = require('cors');
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pyeyw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try{
        await client.connect();
        const appointmentCollection = client.db('doctors').collection('appointment');
        const bookingCollection = client.db('doctors').collection('booking')

        app.get('/appointment', async(req, res) => {
            const query = {};
            const cursor = appointmentCollection.find(query);
            const appointments = await cursor.toArray();
            res.send(appointments);
        });

        app.post('/booking', async(req, res) => {
          const bookingInfo = req.body;
          const query = {treatmentName: bookingInfo.treatmentName, date: bookingInfo.date, patientEmail: bookingInfo.patientEmail }
          const filter = await bookingCollection.findOne(query);
          if (filter) {
            return res.send({success: false, booking: filter})
          }
          const result = await bookingCollection.insertOne(bookingInfo);
          return res.send({success: true, result})
        })

        app.get('/available', async(req, res) => {
          const date = req.query.date;

          //step 1: get all appointments
          const appointments = await appointmentCollection.find().toArray();

          //step 2: get the bookings of that day output: [{}, {}, {},{}, {}, {}]
          const query = {date: date};
          const bookings = await bookingCollection.find(query).toArray();

          //step 3: for each appointment
          appointments.forEach(appointment => {
            //step 4: find bookings for that appointment. output: [{}, {}, {}]
            const appointmentBookings = bookings.filter(book => book.treatmentName === appointment.name)

            //step 5: select the slots for the appointment bookings.
            const bookedSlots = appointmentBookings.map(book => book.slot);

            // step 6: select those slots that are not in bookedSlots
            const available = appointment.slots.filter(slot => !bookedSlots.includes(slot));
            //step 7: set available to slots to make it easier 
            appointment.slots = available;
          })

          res.send(appointments);
        })

        // my bookings in dashboard
        app.get('/booking', async(req, res) => {
          const patientEmail = req.query.patientEmail;
          const query = {patientEmail: patientEmail};
          const bookings = await bookingCollection.find(query).toArray();
          res.send(bookings);
        })


    }
    catch{
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Doctors portal on port ${port}`)
})