require("dotenv").config()
const Order = require('../../../models/order')
const moment = require('moment')
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY)


function orderController() {
    return {
        store(req, res) {
            // validate request
            const { phone, address, stripeToken, paymentType } = req.body
            const payment_Type = paymentType
            console.log(phone, address, stripeToken, payment_Type)
            if (!phone || !address) {
                return res.status(422).json({ message: 'Please enter the details' })
            }

            const order = new Order({
                customerId: req.user._id,
                items: req.session.cart.items,
                phone:phone,
                address
            })

            order.save().then(result => {
                
                Order.populate(result, { path: 'customerId' },async (err, placedOrder) => {
                    console.log('stripe token', payment_Type, stripeToken)

                    // stripe payment
                    if (paymentType === 'card') {


                      

                        // stripe.charges.create({
                        //     amount: req.session.cart.totalPrice * 100,
                        //     source: stripeToken,
                        //     currency: 'inr',
                        //     description: `Pizza order: ${placedOrder._id}`
                        // })

                        // stripe.sources.create({
                        //     type: 'card',
                        //     card: { token: stripeToken }
                        // }).then((source) => {
                        // }).catch(err => {
                        //     console.log(err)
                        // })

                        const paymentintent = await stripe.paymentIntents.create({
                            payment_method_types: ['card'],
                            amount: req.session.cart.totalPrice * 100,
                            description: `Pizza order: ${result._id}`,
                            currency: 'inr'
                          
                        }).then(() => {
                        
                            placedOrder.paymentStatus = true
                            placedOrder.paymentType = payment_Type
                            console.log('+++++++++',placedOrder);
                            console.log('payment successful', result.paymentStatus );
                            placedOrder.save().then((ord) => {
                                console.log('new type in database i.e card')

                                // Emit for realtime
                                const eventEmitter = req.app.get('eventEmitter')
                                eventEmitter.emit('orderPlaced', ord)
                                delete req.session.cart
                                return res.json({ message: 'Order placed successfully😄' })
                            }).catch(err => {
                                console.log('we got err ', err)
                            })
                        }).catch(err => {

                            delete req.session.cart
                            return res.json({ message: 'Order placed but payment failed, You can pay at delivery time' })
                        })







                    } else {
                        const eventEmitter = req.app.get('eventEmitter')
                        eventEmitter.emit('orderPlaced', result)
                        delete req.session.cart
                        return res.json({ message: 'Order placed succesfully' });
                    }

                })
                console.log('----------', result)

            }).catch(err => {
                return res.status(500).json({ message: 'Something went wrong, Order not saved' })
            })
        },

        async index(req, res) {
            console.log('orders')
            const orders = await Order.find({ customerId: req.user._id },
                null,
                { sort: { 'createdAt': -1 } })
            res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0')
            res.render('customers/orders', { orders, moment })
        },
        async show(req, res) {
            const order = await Order.findById(req.params.id)
            console.log({ order })
            //  Authorize user
            if (req.user._id.toString() === order.customerId.toString()) {
                return res.render('customers/singleOrder', { order })
            }
            return res.render('customers/singleOrder')

        }
    }
}


module.exports = orderController