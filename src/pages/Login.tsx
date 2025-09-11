import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Login failed ❌");
    }
  };

  return (
    <section className="login">
  
    <form onSubmit={handleLogin} className="login-form">
      <div className="login-header">
      <h1 className="logoBase"><img src="./logo.png" alt="" srcSet="" width="32" className="logo" />Managify</h1>
      {/* <p>Powered By NativeEdge Studio</p> */}
      </div>
      <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="place" />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)}className="place" />
      <button type="submit" className="login-btn">Login</button>
               <div className="login-header">
      <p> For Subscription Contact: <a href="tel:+923711376983">+92 371 1376983</a><br />Powered By NativeEdge Studio  © {new Date().getFullYear()} Managify. All rights reserved.</p>
      </div>
    </form>
    </section>
  );
};

export default Login;
