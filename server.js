require("dotenv").config()
const express = require('express')
const app = express()
const ejs = require("ejs")
const path = require("path")
const expressLayout = require("express-ejs-layouts")
const PORT = process.env.PORT || 3000
const mongoose = require('mongoose')
const session = require('express-session')
const flash = require('express-flash')
const MongoDbStore = require('connect-mongo')
const passport = require('passport')
const Emitter = require('events')


// database connection

mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_CONNECT_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
// .then(() => console.log("Database connected..."))
// .catch((err) => {
//     console.log('connection is failed due to: ', err);
// })

const connection = mongoose.connection
connection.once('open', () => {
    console.log('Database connected');
}).on("error", (err) => {
    console.log('Connection failed due to:', err)
})




// session store

// let mongoStore = new MongoDbStore({
//     mongooseConnection: connection,
//     collection: 'sessions'
// })



// Event emmiter
const eventEmitter = new Emitter()
app.set('eventEmitter', eventEmitter)


// session cofig
app.use(session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    store: MongoDbStore.create({
        client: connection.getClient()
        // mongoUrl:'mongodb://localhost/pizza'
    }),
    saveUninitialized: false,
    cookie: {   maxAge: 1000 * 60 * 60 * 24 } /* 24 hours */
}))




// passport config
const passportInit = require('./app/config/passport')
passportInit(passport)
app.use(passport.initialize())
app.use(passport.session())



app.use(flash())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())


// Global middleware
app.use((req, res, next) => {
    res.locals.session = req.session
    res.locals.user = req.user
    next()
})

// set template engine
app.use(expressLayout)
app.set("views", path.join(__dirname, "/resources/views"))
app.set("view engine", "ejs")



require('./routes/web')(app)




// assets

app.use(express.static('public'))

const server = app.listen(PORT, () => {
    console.log(`Listening on port at ${PORT}`);
})



// server

const io = require('socket.io')(server)
io.on('connection', (socket) => {
    socket.on('join', (roomId) => {
        console.log('rooooom idddddddddddddddd',roomId)
        socket.join(roomId)
    })
})


eventEmitter.on('orderUpdated', (data) => {
    io.to(`order_${data.id}`).emit('orderUpdated', data)
    console.log(data, 'at serverjs')

})
eventEmitter.on('orderPlaced', (data) => {
    io.to(`adminRoom`).emit('orderPlaced', data)
})