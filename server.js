const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')

// Connect to DB
mongoose.connect(YOUR_MONGODB_URI)
var status = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};
console.log("Mongo DB " + status[mongoose.connection.readyState]);


app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

//Create Schemas and models for the DB
var Schema = mongoose.Schema;
var userSchema = new Schema({
  username: {type:String, unique:true},
  exercises: [String]    // add the description of the exercises
})
var exerciseSchema = new Schema({
  userId: Array,
  description: {type:String, unique:true},
  duration: Number,
  date: Date
})

var userModel = mongoose.model('User',userSchema);
var exerciseModel = mongoose.model('Exercise',exerciseSchema);


// Serve HTML & CSS
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Create user
app.post('/api/exercise/new-user',function(req,res){
  var username=req.body.username;
  var new_user = new userModel ({username: username});
  new_user.save()
          .then(item=>{
            console.log('New user saved in DB')
            res.json({'username':username,'_id':item._id});
            })
          .catch(err=>{
            res.send('User NOT saved in DB, check if already exists in DB')
            console.error(err)
            });
})


// Get array of all users (only username and id)
app.get('/api/exercise/users',function(req,res){
  userModel.find({},function(err,userFound){
    if(err) return console.error(err);
    res.send(userFound.map(x=>({'username': x.username,'_id': x._id})));
  })
});


// add exercise to a user id
app.post('/api/exercise/add',function(req,res){
  var id = req.body.userId
  var description = req.body.description
  var duration = req.body.duration
  var date = req.body.date
  if(req.body.date=='' || req.body.date==' '){  //add present date field if date is empty
    date = new Date();
  }
  // add exercise to the user array
  userModel.findById({_id:id},function(err,userFound){
     if (err){
       res.send('Error, check if the User ID is correct')
       return console.error(err)};
    userFound.exercises.push(description);
    userFound.save()
              .then(item=>console.log('Excercise added to user'))
              .catch(err => console.error(err))
  
  
    // check if the exercise exists already. if it does, only add the userId, if it doesn't create as new
    exerciseModel.find({description:description},function(err,exerciseFound){
      if(err){    
          return console.error(err);

      }else if(!exerciseFound.length){  // Exercise doesn't exist, create and save
        // create and save new exercise in the exerciseModel
          var new_exercise = new exerciseModel({
            userId:id,
            description: description,
            duration: duration,
            date: date
          });

            new_exercise.save()
                      .then(item=>{console.log('New exercise created in DB');
                                  res.json({username: userFound.username, _id:id, description:description, duration:duration, date:date})
                                  })
                      .catch(err => res.send('Error: Could not save exercise to DB, check if already exists in DB'))

      }else{
      // Exercise exists, only add the new user

        exerciseModel.findOneAndUpdate({description:description},
                            { $push: {userId:id}},{new:true},(err,data)=>{
          if(err) return console.error(err);
          console.log('Users updated for the exercise')
        })
      res.json({username: userFound.username, _id:id, description:description, duration:duration, date:date})
      };
      
    })

  });
  
});

// Exercise log of userId(_id) return is username, id, exercise array and total exercise count 
// filter according to /log?userId=<_id>&from=<date_from>&to=<date_to>&limit=<limit>
app.get('/api/exercise/log',function(req,res){
  var id = req.query.userId;
  var from = req.query.from;
  var to = req.query.to;
  var limit = req.query.limit;
  var exercises_data;
  
 
  userModel.findById({_id:id},function(err,userFound){
     if (err){
       res.send('Error, check if the User ID is correct')
       return console.error(err)
       };
       if(limit==undefined){limit=userFound.exercises.length};
       if(from==undefined){from='1900-01-01'};
       if(to==undefined){to='2200-12-31'}
        // Get the exercise data
       exerciseModel.find({description: {$in: userFound.exercises}, date:{ $gte:(from), $lt:(to)}}, { _id:0, userId:0, __v:0})
                      .limit(Number(limit))
                     .exec(function(err,data){
         if(err) console.error(err);
         var total_exercises = data.length;
        res.json({username:userFound.username, _id:userFound._id, count:total_exercises, log: data });
       });
    
   });
 });


// Not found middleware
//app.use((req, res, next) => {
 // return next({status: 404, message: 'not found'})
//})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
