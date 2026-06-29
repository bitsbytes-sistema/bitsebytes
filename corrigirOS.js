const mongoose = require("mongoose");
require("dotenv").config();

const Ticket = require("./models/Ticket");

mongoose.connect(process.env.MONGO_URL);

async function corrigir() {

    const tickets = await Ticket.find({})
        .sort({ createdAt: 1 });

let numero = 1;

for (const ticket of tickets) {

    await Ticket.updateOne(
        { _id: ticket._id },
        { $set: { numeroOS: numero } }
    );

    console.log(`OS ${numero} -> ${ticket.cliente}`);

    numero++;
}

    console.log("Concluído!");
    process.exit();
}

corrigir();