require('dotenv');
const express = require('express');
const app = express()
const PORT = process.env.PORT || 3000


app.use(express.json())
appp.use('/api', productRoutes)

app.listen(PORT, () => { 
    console.log(`server is successfully running on port ${PORT}`)
})