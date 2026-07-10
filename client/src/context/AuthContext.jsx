import {createContext,useContext,useMemo,useState,useEffect} from 'react';
const AuthContext=createContext(null);
export function AuthProvider({children}){const [user,setUser]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('user')||'null')}catch{return null}});const [token,setToken]=useState(()=>sessionStorage.getItem('token'));
 const login=(u,t)=>{sessionStorage.setItem('user',JSON.stringify(u));sessionStorage.setItem('token',t);setUser(u);setToken(t)};const logout=()=>{sessionStorage.clear();setUser(null);setToken(null)};
 useEffect(()=>{const h=()=>logout();window.addEventListener('auth:expired',h);return()=>window.removeEventListener('auth:expired',h)},[]);
 const value=useMemo(()=>({user,token,login,logout,setUser}),[user,token]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export const useAuth=()=>useContext(AuthContext);
