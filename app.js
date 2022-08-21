// let socketmap=new Map(); //gives socketid for a userid
// let usermap=new Map(); //gives userid for a socketid
// let chatdata=new Map();  //stores all messages of two users

//See userdisconnected method again. 

const express=require('express');
const http=require('http');

const app=express();
const server=http.createServer(app);
const {Server}=require('socket.io');
const io=new Server(server);
// io.on('connection', (socket) => {
//     console.log('a user connected');
// });
app.set('view engine','ejs');

const mongoose=require('mongoose');
const session=require('express-session');
const flash=require('connect-flash');
const MongoDBStore=require('connect-mongo')(session);

const mongoString='mongodb+srv://Sagar63:SagarSinghKushwah@cluster0.attfc.mongodb.net/SocialMedia?retryWrites=true&w=majority';
//const mongoString="mongodb://localhost:27017/socmed";

mongoose.connect(mongoString,{useNewUrlParser:true,useUnifiedTopology:true})
.then(()=>{console.log('Connected to DB');})
.catch((err)=>{console.log('Error',err);});


const passport = require('passport');
const LocalStrategy=require('passport-local');
const passportLocalMongoose=require('passport-local-mongoose');

const joi=require('joi');
const res = require('express/lib/response');
const { KeyObject } = require('crypto');


app.use(express.urlencoded({extended:true}));
app.use(express.json());

const userSchema=new mongoose.Schema({
    // userName:{
    //     type:String,
    //     required:true,
    // },
    age:{
        type:Number,
        required:true
    },
    about:{
        type:String,
        required:true
    },
    friends:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:'User'
        }
    ],
    job:{
        type:String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    posts:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Post',
        
    }] ,
    requests:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        
    }],
    // password:{
    //     type:String
    // },
    sentrequests:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
        }
    ],
    
        
    
});

userSchema.plugin(passportLocalMongoose); //will add username,salt,hashedpassword into schema 

const store=new MongoDBStore({
    url:mongoString,
    secret:'randomsecret',
    touchAfter:24*60*60   //in seconds
})

store.on("error",function(e) {
    console.log('Store Error',e);
})

const User=mongoose.model('User',userSchema);

const sessionConfig={
    store,  //stores session/cookies in mongodb instead of local memory that vanish if server restart. 
    secret:'randomsecret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,    //in miliseconds
        maxAge: 1000 * 60 * 60 * 24 * 7
    } //Will set time (if this is not used then login again if chrome is closed)

}

app.use(session(sessionConfig)); //use of resave and saveuniti
app.use(flash());

app.use(passport.initialize());
app.use(passport.session()); // To use persistent login (So that we dont have to login again and again)

passport.use(new LocalStrategy(User.authenticate()));  //passport-local-mongoose adds authenticate method which can be used here for local strategy.
passport.serializeUser(User.serializeUser());  // Serialize means how to store user into session.
passport.deserializeUser(User.deserializeUser());  //How to get user out of the session.
//all these methods are added by passport-local-mongoose in out User schema.


const postSchema=new mongoose.Schema({
    userid:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    title:{
        type:String,
        required:true
    },
    thoughts:{
        type:String,
        required:true
    },
    likes:{
        type:Number,
        default:0
    },
    comments:[{
        userid:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'},
        comment:{
            type:String,
            required:true
        },
        _id:false   //so that new _id is not given by default
    }],
    date:{
        type:Date,
        default:Date.now()
    },
    likeusers:{
        type:Map,
        of:Boolean,
        default:{}
    }
});

const Post=mongoose.model('Post',postSchema);

class ExpressError extends Error{
    constructor(message,status){
        super();
        this.message=message; this.status=status;
    }
}
//console.log('Hello');
const mapdataSchema = new mongoose.Schema({
    // chatdata: {
    //   type: Map,
    //   of: [{
    //       userid:String, msg:String
    //   }]
    // },
    usermap: {
        type:Map,
        of: String
    },
    socketmap: {
        type:Map,
        of: String
    }
  });
  
  const Mapdata = mongoose.model('Mapdata',mapdataSchema);

  const chatdataSchema=new mongoose.Schema({
      key:String,
      chats:[{
          userid:String, msg:String
      }]
  });

  const Chatdata=mongoose.model('Chatdata',chatdataSchema);

  const checkforOneMapdata=async (req,res,next)=>{
      const data=await Mapdata.find({});
     // console.log('Mapdata-',data);
      if(data.length===0){
        //console.log('Size is zero');
       let tmp=new Mapdata({
            //chatdata:{},
            usermap:{},
            socketmap:{}
        })
        await tmp.save();
      }
      else{
         //console.log('Size not zero',data);
      }
      next();
  }

const joiUserSchema=joi.object({
    username:joi.string().min(3).max(20).required(),
    age:joi.number().integer().min(10).max(100).required(),
    about:joi.string().min(6).max(100).required(),
    job:joi.string().min(3).max(20).required(),
    city:joi.string().min(3).max(20).required(),
    password:joi.string().min(6).max(20).required()
})

const joiPostSchema=joi.object({
    title:joi.string().min(3).max(30).required(),
    thoughts:joi.string().min(4).max(500).required(),
})

const validateUser=(req,res,next)=>{
    const {error}=joiUserSchema.validate(req.body);
    if(error){
        let message=error.details.map((el)=>{return (el.message+",");});
       throw new ExpressError(message,400);
    
    }
    else{
    next();}
}

const validatePost=(req,res,next)=>{
    const {error}=joiPostSchema.validate(req.body);
    if(error){
        
       let message=error.details.map((el)=>{return el.message+",";});
       throw new ExpressError(message,400);
    
      
    }
    else{
    next();}
}

const isLoggedIn=function(req,res,next){
    if(!req.isAuthenticated()){  // method provided by passport.
       return res.redirect('/login');
    }
    next();
}

const logUserOut=function(req,res,next){
    if(req.isAuthenticated()){
        req.logout();
    }
    next();
}

const port=process.env.PORT || 3000;
server.listen(port,()=>{
    console.log(`Listening On Port ${port}`);
})

app.use((req,res,next)=>{
    res.locals.currentuser=req.user;
    
   
    next();
});

app.get('/',isLoggedIn,async (req,res)=>{
    const userinfo=await User.findById(req.user._id);
    const allfriends=userinfo.friends;
    let posts=[];
    for(let friendid of allfriends){
      const friend=await User.findById(friendid);
      for(let postid of friend.posts){
          const post=await Post.findById(postid).populate('userid','username');
          posts.push(post);
      }
    }
    posts.sort(function (a,b){return (a.date-b.date);});
   // console.log(posts); //res.send('Hello');
    
    res.render('home',{posts,curuserid:req.user._id});
})

app.get('/profile/:userid',isLoggedIn,async (req,res)=>{
    const {userid}=req.params;
    const user=await User.findById(userid).populate('friends').populate('posts')
    .populate({
        path:'posts',
        populate:{
            path:'userid'
        }
    });  //how to do multilevel populating.
   // console.log(user); //res.send('Hello'); 
    res.render('profile',{user,curuserid:req.user._id});
})

app.get('/createpost',isLoggedIn,(req,res)=>{
    const userid=req.user._id;
    res.render('createpost',{curuserid:req.user._id});
})

app.get('/request',isLoggedIn,async (req,res)=>{
    const curuser=await User.findById(req.user._id).populate('requests');
    res.render('request',{curuserid:req.user._id,curuser});
})

app.get('/suggestion',isLoggedIn,async (req,res)=>{
    let userinfo=await User.findById(req.user._id).populate('friends');
    
    let allfriends=userinfo.friends;
    let allusers=await User.find({});
    let suggest=[];
    for(let user of allusers){ let ok=true;
        for(let friend of allfriends){
          if((JSON.stringify(user._id)===JSON.stringify(friend._id)) ){
              ok=false; break;
          }
            
        }
        if((JSON.stringify(user._id)===JSON.stringify(userinfo._id))){ok=false;}
        if(ok){suggest.push(user);}
    }
    for(let request of userinfo.requests){
        suggest=suggest.filter((sugg)=>{
            return JSON.stringify(request._id)!==JSON.stringify(sugg._id);
        })
    }
    for(let sentreq of userinfo.sentrequests){
        suggest=suggest.filter((sugg)=>{
           return JSON.stringify(sentreq._id)!==JSON.stringify(sugg._id);
        })
    }
    res.render('suggestion',{suggest,curuserid:req.user._id});
})

app.get('/register',logUserOut,(req,res)=>{
    res.render('register');
})

app.post('/register',logUserOut,validateUser,async (req,res,next)=>{     
    try{
   const {username,age,about,job,city,password}=req.body;
   const user=new User({username,age,about,job,city});
   const newuser=await User.register(user,password);   //this register method is provided by passport-local-mongoose
   req.login(newuser,()=>{  //add error
       res.redirect('/');
   })
   
}
   catch(err){
       next(err);
   }

});

app.get('/message',isLoggedIn,async (req,res)=>{
    let curruser=await User.findById(req.user._id).populate('friends');
    let allfriends=curruser.friends;
    
    res.render('message',{allfriends,curuserid:req.user._id});
})


app.get('/login',logUserOut,async (req,res)=>{
    res.render('login');
})

app.post('/userconnected',isLoggedIn,checkforOneMapdata,async(req,res)=>{
   //how to check if socketid sent is valid
   const {socketid}=req.body;
   let userid=req.user._id; 
   userid=JSON.stringify(userid);  //to remove new object prefixed with id

   const alldata=await Mapdata.find({}); const data=alldata[0];
   data.socketmap.set(userid,socketid);
   data.usermap.set(socketid,userid);
   await data.save();

  // socketmap.set(userid,socketid); usermap.set(socketid,userid);
   
   res.send('done');
})

app.get('/userdisconnected',isLoggedIn,checkforOneMapdata,async(req,res)=>{
    let userid=req.user._id; userid=JSON.stringify(userid);
    const alldata=await Mapdata.find({}); const data=alldata[0];
  //  let socketid=socketmap.get(userid);
    let socketid=data.socketmap.get(userid);
    data.socketmap.delete(userid); data.usermap.delete(socketid);
    await data.save();
    console.log(userid,socketid); console.log(userid, 'disconnected');
    res.send('done2');
})

app.post('/getsocketid',isLoggedIn,checkforOneMapdata,async(req,res)=>{
    let {userid}=req.body; 
    userid+='"'; userid='"'+userid;
    const alldata=await Mapdata.find({}); const data=alldata[0];
   // const socketid=socketmap.get(userid);
   const socketid=data.socketmap.get(userid);
   // console.log(userid,socketid,'here');
    res.send(socketid);
})

app.post('/getuserid',isLoggedIn,checkforOneMapdata,async(req,res)=>{
    let {socketid}=req.body; 
    const alldata=await Mapdata.find({}); const data=alldata[0];
    //let userid=usermap.get(socketid); 
    let userid=data.usermap.get(socketid);
    res.send(userid);
})

app.get('/getcurruser',isLoggedIn,(req,res)=>{
    res.send(req.user._id);
})

// app.post('/getchatdata',checkforOneMapdata,async(req,res)=>{
//     let {key}=req.body;
//     const alldata=await Mapdata.find({}); const data=alldata[0];
//     if(!data.chatdata.get(key)){
//         let chats=[];
//         res.send(chats);
//     }
//     else{
//         let chats=data.chatdata.get(key);
//         console.log('chats-',chats);
//         res.send(chats);
//     }
// })

app.post('/getchatdata',isLoggedIn,checkforOneMapdata,async(req,res)=>{
    let {key}=req.body; //console.log('key-',key,'curruser-',JSON.stringify(req.user._id));
    let curruserid=JSON.stringify(req.user._id);
    let tmp="",i=1;
    while(curruserid[i]!='"'){tmp+=curruserid[i]; i++;} 
    curruserid=tmp;
    if(key.length<=curruserid.length){return res.send('No permission granted');}
    if(curruserid!==key.substring(0,curruserid.length)){return res.send('No permission granted');}
    
    let data=await Chatdata.findOne({key:key});

    if(!data){
        res.send([]);
    }
    else{
       res.send(data.chats);
    }
})

app.post('/login',logUserOut,passport.authenticate('local',{failureFlash:true,failureRedirect:'/login'}),(req,res)=>{
    res.redirect('/');
})

app.get('/logout',(req,res)=>{
    req.logout(); res.redirect('/login');
})

app.post('/likebtnclick',isLoggedIn,async (req,res)=>{
    const {postid}=req.body;
    const post=await Post.findById(postid);
    
    if(post.likeusers.get(req.user._id)){
      post.likes--;
      post.likeusers.set(req.user._id,false);
      await post.save();
      res.send((post.likes).toString());
    }
    else{
        post.likes++;
        post.likeusers.set(req.user._id,true);
        await post.save();
     res.send((post.likes).toString());
    }
  //  res.send(postid);
})

app.post('/commentbtnclick',isLoggedIn,async (req,res)=>{
    const {postid,commenttext}=req.body;
    const post=await Post.findById(postid);
    const tmp={userid:req.user._id,comment:commenttext};
 //   await Post.updateOne({_id:postid},{$push:{comments:tmp}});
    post.comments.push({userid:req.user._id,comment:commenttext}); await post.save();
    
    res.send((post.comments.length).toString());
})

app.post('/allcommentclick',isLoggedIn,async (req,res)=>{
    const {postid}=req.body;
    const post=await Post.findById(postid).populate('comments.userid');
    
    res.send(post.comments);
    //res.send(`Button clicked for postid: ${postid}`);
})

app.post('/:userid',isLoggedIn,
(req,res,next)=>{
const {userid}=req.params;
if(JSON.stringify(userid)===JSON.stringify(req.user._id)){next();}
else{res.send('You are not authorised!!'); }
},
validatePost,
async (req,res,next)=>{      //for new post
       try{const {userid}=req.params;
    const user=await User.findById(userid);
    const {title,thoughts}=req.body;
    const post=await Post.insertMany([{title:title,thoughts:thoughts,userid:userid}]);
    await User.updateOne({_id:userid},{$push:{posts:post}})
    
  
   res.redirect('/');}
   catch(err){
       next(err);
   }
});

app.post('/request/:senderid/:receiverid',isLoggedIn,
(req,res,next)=>{
    const {senderid,receiverid}=req.params;
    if(JSON.stringify(senderid)===JSON.stringify(req.user._id)){
        next();
    }
    else{
        res.send('You are not authorised!!')
    }
},
async(req,res,next)=>{
    try{
    const {senderid,receiverid}=req.params;
    const sender=await User.findById(senderid);
    const receiver=await User.findById(receiverid);
    await User.updateOne({_id:senderid},{$push:{sentrequests:receiver}});
    await User.updateOne({_id:receiverid},{$push:{requests:sender}});
    res.redirect('/suggestion');}
    catch(err){
        next(err);
    }
})

app.post('/accept/:senderid/:receiverid',isLoggedIn,
(req,res,next)=>{
    const {senderid,receiverid}=req.params;
    if(JSON.stringify(receiverid)===JSON.stringify(req.user._id)){next();}
    else{
        res.send('You are not authorised!!');
    }
},
async(req,res,next)=>{
    try{
        const {senderid,receiverid}=req.params;
        const sender=await User.findById(senderid);
    const receiver=await User.findById(receiverid);
    await User.updateOne({_id:senderid},{$push:{friends:receiver}});
    await User.updateOne({_id:receiverid},{$push:{friends:sender}});
    let requests=receiver.requests;
    requests=requests.filter((request)=>{
        return JSON.stringify(request._id)!==JSON.stringify(sender._id);
    })
    await User.updateOne({_id:receiverid},{requests:requests}); 
    
   res.redirect('/request')
}
    catch(err){
        next(err);
    }
})

app.all('*',(req,res,next)=>{
    
 throw new ExpressError('Page Not Found',404);
 
})

app.use((err,req,res,next)=>{
    if(!err.status){err.status=500;}
    if(!err.message){err.message='Something Went Wrong';}
    res.status(err.status).render('error',{err});
    
})

// io.use((socket, next) => {
//     const username = socket.handshake.auth.username;
//     if (!username) {
//       return next(new Error("invalid username"));
//     }
//     socket.username = username;
//     next();
//   });

// io.on('connection', (socket) => {

//     console.log('a user connected');
//     socket.on('disconnect', () => {
//         console.log('user disconnected');
//       });
//     socket.on('chat message',(msg)=>{
//        console.log(msg);
//        io.emit('chat message',msg);
//     })
    
// });

io.on("connection",(socket) => {

    // const users = [];
    // for (let [id, socket] of io.of("/").sockets) {
    //   users.push({
    //     userID: id,
    //     username: socket.username,
    //   });
    // }
    // socket.emit("users", users);
    // ...
    // socket.broadcast.emit("user connected", {
    //     userID: socket.id,
    //     username: socket.username,
    //   });
    // ...
    socket.on("private message",async ({ content, to,to_userid }) => {
         
         const data=await Mapdata.findOne();
         let sender=socket.id,receiverid=to_userid; 
         let senderid=data.usermap.get(sender);
         let i=1; let tmp="";
         while(senderid[i]!='"'){tmp+=senderid[i]; i++;} senderid=tmp; //removing quotes from senderid
         let key=senderid+','+receiverid;
         let chatdata=await Chatdata.findOne({key:key});
        //  if(!data.chatdata.get(senderid+','+receiverid)){
        //       let chats=[];
        //       chats.push({
        //           userid:senderid, msg:content
        //       });
        //       data.chatdata.set(senderid+','+receiverid,chats); data.chatdata.set(receiverid+','+senderid,chats);
        //       await data.save();
        //  }
         if(!chatdata){
             let chats=[];
             chats.push({
             userid:senderid, msg:content
                     });
             let chatdata1=new Chatdata({key:senderid+','+receiverid,chats:chats});        
             let chatdata2=new Chatdata({key:receiverid+','+senderid,chats:chats}); 
             await chatdata1.save(); await chatdata2.save();  
         }
        //  else{
        //       let chats=data.chatdata.get(senderid+','+receiverid);
        //       chats.push({
        //         userid:senderid, msg:content
        //     });
        //     data.chatdata.delete(senderid+','+receiverid);
        //     data.chatdata.set(senderid+','+receiverid,chats);
        //     await data.save();

        //     chats=data.chatdata.get(receiverid+','+senderid);
        //     chats.push({
        //         userid:senderid, msg:content
        //     });
        //     data.chatdata.delete(receiverid+','+senderid);
        //     data.chatdata.set(receiverid+','+senderid,chats);
        //     await data.save();
        //  }
         else{
            await Chatdata.findOneAndUpdate({key:senderid+','+receiverid},{ $push: { chats:{userid:senderid,msg:content} } });
            await Chatdata.findOneAndUpdate({key:receiverid+','+senderid},{ $push: { chats:{userid:senderid,msg:content} } });
         }
           //console.log(chatdata.get(senderid+','+receiverid),chatdata.get(receiverid+','+senderid));

   
    
        if(!to){
           // console.log('User is offline');
        }
        else{
        
       // console.log('Inside private message on server side');
        //console.log(content,to);
        socket.to(to).emit("private message", {
          content,
          from: socket.id,
        });}
      });
      socket.on("disconnect",async ()=>{
        const alldata=await Mapdata.find({}); const data=alldata[0];
          let socketid=socket.id; let userid=data.usermap.get(socketid);
          if(userid){data.socketmap.delete(userid);} // userid is undefined when server is restarted with page being the old page 
           data.usermap.delete(socketid);
           await data.save();
          console.log('User deleted');
      })
  });





//req.user contains the deserialize information from session using passport.
//req.user._id,req.user.username