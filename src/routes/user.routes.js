import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshAccessToken, changePassword, fetchCurrentUser, updateUserData, updateAvatar } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);


//secured route
router.route("/logout").post(verifyJWT,logoutUser);
router.route("/refresh-token").post(refreshAccessToken);

router.route("/change-password").patch(verifyJWT,changePassword);
router.route("/fetch-user").get(verifyJWT,fetchCurrentUser);
router.route("/update-details").patch(verifyJWT,updateUserData);
router.route("/update-avatar").patch(verifyJWT,upload.fields([{
  name:"avatar",
  maxcount:1,
},
]),updateAvatar);


export default router;
