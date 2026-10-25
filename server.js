require('dotenv').config()
const express = require('express')
const {MongoClient, ObjectId} = require('mongodb')

const app = express()
// const bodyParser = require('body-parser')
const PORT = process.env.PORT || 3000
const dbName = process.env.DB_NAME || 'stylequity'
const url = process.env.MONGODB_URI

let db
// var db, collection;

// Configure EJS as template engine
app.set('view engine', 'ejs')

// Allows Express to process form submissions and JSON
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Serves CSS, JavaScript, and images
app.use(express.static('public'))

// Homepage: Retrieve wardrobe items and display the collection
app.get('/', async (req, res) => {
  try {
    const items = await db.collection('items').find().toArray()

    res.render('index.ejs', { items })

  } catch (error) {
    console.error('Error loading Stylequity:', error)
    res.status(500).send('Something went wrong.')
  }
})

// CREATE: To add a new wardrobe item to MongoDB
app.post('/items', async (req, res) => {
  try {
    // Retrieves the information submitted through the form
    const {
      itemName,
      category,
      brand = '',
      itemType = '',
      purchasePrice,
      timesUsed,
      estimatedResaleValue,
      imageUrl
} = req.body

    // Converts numerical form values from strings into numbers
    const price = Number(purchasePrice)
    const uses = Number(timesUsed)

    // Resale value is optional
    const resaleValue = estimatedResaleValue === ''
      ? null
      : Number(estimatedResaleValue)

    // Validates the submitted information
    const allowedCategories = [
      'Apparel',
      'Footwear',
      'Accessories',
      'Furniture',
      'Home Decor',
      'Beauty & Devices'
    ]

    if (
      !itemName?.trim() ||
      !allowedCategories.includes(category) ||
      typeof brand !== 'string' ||
      brand.trim().length > 100 ||
      typeof itemType !== 'string' ||
      itemType.trim().length > 80 ||
      purchasePrice === '' ||
      !Number.isFinite(price) ||
      price < 0 ||
      timesUsed === '' ||
      !Number.isInteger(uses) ||
      uses < 0 ||
      (resaleValue !== null &&
        (!Number.isFinite(resaleValue) || resaleValue < 0))
    ) {
      return res.status(400).send('Please enter valid item details.')
    }

    // Creates the wardrobe item
    const newItem = {
      itemName: itemName.trim(),
      category: category,
      brand: brand.trim(),
      itemType: itemType.trim(),
      purchasePrice: price,
      timesUsed: uses,
      estimatedResaleValue: resaleValue,
      imageUrl: imageUrl?.trim() || '',
      createdAt: new Date()
    }

    // Saves the item in the MongoDB items collection
    await db.collection('items').insertOne(newItem)

    console.log('Item saved to database:', newItem.itemName)

    // Returns to the homepage
    res.redirect('/')

  } catch (error) {
    console.error('Error adding item:', error)
    res.status(500).send('Unable to add item.')
  }
})

// UPDATE: Records one additional wear or use of an item
app.post('/items/:id/use', async (req, res) => {
  try {
    const itemId = req.params.id

    // Checks that the item ID is valid
    if (!ObjectId.isValid(itemId)) {
      return res.status(400).send('Invalid item ID.')
    }

    // Increases the item's usage count by one
    const result = await db.collection('items').updateOne(
      { _id: new ObjectId(itemId) },
      { $inc: { timesUsed: 1 } }
    )

    // Handles an item that does not exist
    if (result.matchedCount === 0) {
      return res.status(404).send('Item not found.')
    }

    console.log('Item usage updated:', itemId)

    // Returns to the homepage
    res.redirect('/')

  } catch (error) {
    console.error('Error updating item usage:', error)
    res.status(500).send('Unable to update item usage.')
  }
})

// DELETE: Removes an item from the collection
app.post('/items/:id/delete', async (req, res) => {
  try {
    const itemId = req.params.id

    // Checks that the item ID is valid
    if (!ObjectId.isValid(itemId)) {
      return res.status(400).send('Invalid item ID.')
    }

    // Deletes the matching item from MongoDB
    const result = await db.collection('items').deleteOne({
      _id: new ObjectId(itemId)
    })

    // Handles an item that no longer exists
    if (result.deletedCount === 0) {
      return res.status(404).send('Item not found.')
    }

    console.log('Item deleted:', itemId)

    // Returns to the updated collection
    res.redirect('/')

  } catch (error) {
    console.error('Error deleting item:', error)
    res.status(500).send('Unable to delete item.')
  }
})

// EDIT: Retrieves an existing item and displays the edit page
app.get('/items/:id/edit', async (req, res) => {
  try {
    const itemId = req.params.id

    // Checks that the item ID is valid
    if (!ObjectId.isValid(itemId)) {
      return res.status(400).send('Invalid item ID.')
    }

    // Finds the matching item in MongoDB
    const item = await db.collection('items').findOne({
      _id: new ObjectId(itemId)
    })

    // Handles an item that does not exist
    if (!item) {
      return res.status(404).send('Item not found.')
    }

    // Displays the edit page with the item's current information
    res.render('edit.ejs', { item })

  } catch (error) {
    console.error('Error loading item for editing:', error)
    res.status(500).send('Unable to load item for editing.')
  }
})

// UPDATE: Saves changes to an existing wardrobe item
app.post('/items/:id/edit', async (req, res) => {
  try {
    const itemId = req.params.id

    // Checks that the item ID is valid
    if (!ObjectId.isValid(itemId)) {
      return res.status(400).send('Invalid item ID.')
    }

    // Gets the updated information from the form
    const {
      itemName,
      category,
      brand = '',
      itemType = '',
      purchasePrice,
      timesUsed,
      estimatedResaleValue,
      imageUrl
    } = req.body

    // Validates the text fields
    const validCategories = [
      'Apparel',
      'Footwear',
      'Accessories',
      'Furniture',
      'Home Decor',
      'Beauty & Devices'
    ]

    if (
      typeof itemName !== 'string' ||
      !itemName.trim() ||
      !validCategories.includes(category) ||
      typeof brand !== 'string' ||
      brand.trim().length > 100 ||
      typeof itemType !== 'string' ||
      itemType.trim().length > 80 ||
      typeof imageUrl !== 'string'
    ) {
      return res.status(400).send('Please enter valid item details.')
    }

    // Converts numeric form values into numbers
    const price = Number(purchasePrice)
    const uses = Number(timesUsed)

    // Validates the purchase price and usage count
    if (
      typeof purchasePrice !== 'string' ||
      purchasePrice.trim() === '' ||
      !Number.isFinite(price) ||
      price < 0 ||
      typeof timesUsed !== 'string' ||
      timesUsed.trim() === '' ||
      !Number.isInteger(uses) ||
      uses < 0
    ) {
      return res.status(400).send('Please enter a valid price and usage count.')
    }

    // Estimated resale value is optional
    let resaleValue = null

    if (
      typeof estimatedResaleValue === 'string' &&
      estimatedResaleValue.trim() !== ''
    ) {
      resaleValue = Number(estimatedResaleValue)

      if (!Number.isFinite(resaleValue) || resaleValue < 0) {
        return res.status(400).send('Please enter a valid resale value.')
      }
    } else if (
      estimatedResaleValue !== undefined &&
      typeof estimatedResaleValue !== 'string'
    ) {
      return res.status(400).send('Invalid resale value.')
    }

    // Validates the optional image URL
    const cleanImageUrl = imageUrl.trim()

    if (cleanImageUrl) {
      try {
        const parsedUrl = new URL(cleanImageUrl)

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return res.status(400).send('Please enter a valid image URL.')
        }
      } catch {
        return res.status(400).send('Please enter a valid image URL.')
      }
    }

    // Updates the existing item in MongoDB
    const result = await db.collection('items').updateOne(
      { _id: new ObjectId(itemId) },
      {
        $set: {
          itemName: itemName.trim(),
          category: category,
          brand: brand.trim(),
          itemType: itemType.trim(),
          purchasePrice: price,
          timesUsed: uses,
          estimatedResaleValue: resaleValue,
          imageUrl: cleanImageUrl,
          updatedAt: new Date()
        }
      }
    )

    // Handles an item that does not exist
    if (result.matchedCount === 0) {
      return res.status(404).send('Item not found.')
    }

    console.log('Item updated successfully:', itemId)

    // Returns to the updated collection
    res.redirect('/')

  } catch (error) {
    console.error('Error editing item:', error)
    res.status(500).send('Unable to update item.')
  }
})

// Connects to MongoDB before starting the server
async function startServer() {
  try {
    if (!url) {
      throw new Error('MONGODB_URI is missing from your .env file')
    }

    const client = new MongoClient(url)

    await client.connect()

    db = client.db(dbName)

    await db.command({ ping: 1 })

    console.log(`Connected to MongoDB database: ${dbName}`)

    app.listen(PORT, () => {
      console.log(`Stylequity is running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start Stylequity:', error.message)
    process.exit(1)
  }
}

startServer()
