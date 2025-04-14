import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import uploadOnCloudinary from "../utils/cloudnary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while creating Access or Refresh token"
    );
  }
};

const options = {
  httpOnly: true,
  secure: true,
};

const registerUser = asyncHandler(async (req, res) => {
  //get user detail from frontend

  const { fullname, username, email, password } = req.body;
  console.log("email : ", email);

  //   validation like username is not empty etc

  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const isUserPresent = await User.findOne({
    $or: [{ username }, { email }],
  });

  //   console.log(isUserPresent)

  if (isUserPresent) {
    throw new ApiError(409, "user with email or username already exists");
  }

  console.log(req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "avatar image is also required");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    fullname,
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const userCreated = await User.find(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "user registered succesfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "username or password is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "not a valid Credentials ");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "invalid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logout successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unathorized  request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token expired or used");
    }

    const { newRefreshToken, accessToken } =
      await generateAccessAndRefreshToken(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken : newRefreshToken,
          },
          "Accessed token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while refreshing the Access Token"
    );
  }
});

const changePassword=asyncHandler(async(req,res)=>{
  const {oldPassword,newPassword,confirmPassword}=req.body;

  if(newPassword!==confirmPassword){
   throw new Error(400,'new password does not matches to confirm password')
  }


  const user=await User.findById(req.user._id).select("+password");

  if(!user){
    throw new ApiError(404,"user not found")
  }

  const isPasswordCorrect=await user.isPasswordCorrect(oldPassword);
  if(!isPasswordCorrect){
     throw new ApiError(401,'old password is incorrect')
  }

  user.password=newPassword;

  await user.save({validateBeforeSave:false});
  return  res.status(200).json(new ApiResponse(200,{
    
  },"Password updated succesfully")
  
)})

const fetchCurrentUser=asyncHandler(async(req,res)=>{
  return res.status(200).json(new ApiResponse(200,req.user,'user fetched succesfully')
)})

const updateUserData=asyncHandler(async(req,res)=>{

  const {fullname,username,email}=req.body;
  const user=await User.findByIdAndUpdate(req?.user._id,{
    $set:{
      fullname,
      username,
      email
    },
  },{
    new:true,
  }).select("-password");
  

  return res.status(200).json(new ApiResponse(200,user,'updated details successfully')
  
)})


const updateAvatar=asyncHandler(async(req,res)=>{
  const localPath = req.files?.avatar?.[0]?.path;
  console.log(localPath);
  if(!localPath){
    throw new ApiError(400,"Avatar file is missing")
  }

  const avatar=await uploadOnCloudinary(localPath);

  if(!avatar.url){
      throw new ApiError(400,"Error while uploading avatar")
  }
 
  const user=await User.findByIdAndUpdate(req.user?._id,{
    $set:{
      avatar:avatar.url
    }
  },{new:true}).select("-password")

  return res.status(200).json(new ApiResponse(200,user,"Avatar updated successfully"))

})


export { registerUser, loginUser, logoutUser,refreshAccessToken,changePassword,fetchCurrentUser,updateUserData,updateAvatar };
