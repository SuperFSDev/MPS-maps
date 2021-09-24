const User = require('../models/Users')
const ErrorResponse=require('../utils/errorResponse')
const sendMail=require('../utils/sendEmail')

exports.register=async (req,res,next)=>{
    const {email,password}=req.body
    try{
        const user=await User.create({email,password})
        sendToken(user,201,res)
    }
    catch(error){
        next(error)
    }
}

exports.login=async(req,res,next)=>{
    const {email,password}=req.body
    if(!email || !password){
        return next(new ErrorResponse("Please provide email and password",400))
    }
    try{
        const user=await User.findOne({email}).select("+password")
        if(!user){
            return next(new ErrorResponse("Invalid Credentials",401))
        }
        const isMatch=await user.matchPassword(password)
        if(!isMatch){
            return next(new ErrorResponse("Invalid Credentials",401))
        }
        sendToken(user,200,res)
    }
    catch(error){
        return next(new ErrorResponse(error.message,500))
    }
}

exports.forgotpassword=async(req,res,next)=>{
    const {email}=req.body
    try{
        const user=await User.findOne({email})
        if(!user){
            return next(new ErrorResponse("Email could not be sent",404))
        }
        const resetToken=user.getResetPasswordToken()
        await user.save()
        const resetUrl=`http://localhost:3000/passwordreset/${resetToken}`
        const message=`
            <h1>You have requested a password reset</h1>
            <p>Please go to this link to reset password</p>
            <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
        `
        try{
            await sendMail({
                to:user.email,
                subject:"Password reset request",
                text: message
            })
            res.status(200).json({success:true,data:"Email sent"})
        }
        catch(error){
            user.resetPasswordToken=undefined
            user.resetPasswordExpire=undefined
            await user.save()
            return next(new ErrorResponse("Email could not be sent",500))
        }
    }
    catch(error){
        next(error)
    }
}

exports.resetpassword=async(req,res,next)=>{
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.resetToken).digest("hex");

    try {
        const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorResponse("Invalid Token", 400));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(201).json({
      success: true,
      data: "Password Updated Success",
      token: user.getSignedJwtToken(),
    });
  } catch (err) {
    next(err);
  }
}

const sendToken=(user,statusCode,res)=>{
    const token=user.getSignedJwtToken()
    res.status(statusCode).json({success:true,token})
}