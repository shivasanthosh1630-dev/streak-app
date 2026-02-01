import { useEffect, useState } from "react";

// Firebase
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";

/* ================= FIREBASE ================= */

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* ================= UTILITIES ================= */

const today = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a, b) =>
  Math.floor((new Date(a) - new Date(b)) / 86400000);

function badge(i){
  if(i===0) return "🥇";
  if(i===1) return "🥈";
  if(i===2) return "🥉";
  return "🏅";
}

function isWithinDays(d,days){
  return (new Date()-new Date(d))/86400000<=days;
}

function isThisMonth(d){
  const x=new Date(d),n=new Date();
  return x.getMonth()==n.getMonth() &&
         x.getFullYear()==n.getFullYear();
}

function isThisYear(d){
  return new Date(d).getFullYear()===
         new Date().getFullYear();
}

function getMonthDays(){
  const now=new Date();
  const y=now.getFullYear();
  const m=now.getMonth();
  const count=new Date(y,m+1,0).getDate();

  return Array.from({length:count},(_,i)=>
    new Date(y,m,i+1).toISOString().slice(0,10)
  );
}

/* ================= APP ================= */

export default function App(){

  const [user,setUser]=useState(null);
  const [tasks,setTasks]=useState([]);
  const [newTask,setNewTask]=useState("");
  const [leaderboard,setLeaderboard]=useState([]);
  const [page,setPage]=useState("calendar");

  const [username,setUsername]=useState("");
  const [hasUsername,setHasUsername]=useState(false);
  const [loading,setLoading]=useState(true);

  /* AUTH */
  useEffect(()=>onAuthStateChanged(auth,setUser),[]);

  /* USER DOC */
  useEffect(()=>{
    if(!user) return;

    const ref=doc(db,"users",user.uid);

    getDoc(ref).then(async snap=>{
      if(!snap.exists())
        await setDoc(ref,{tasks:[]});

      else if(snap.data().username){
        setUsername(snap.data().username);
        setHasUsername(true);
      }

      setLoading(false);
    });
  },[user]);

  /* SYNC TASKS */
  useEffect(()=>{
    if(!user) return;
    return onSnapshot(
      doc(db,"users",user.uid),
      s=>setTasks(s.data()?.tasks||[])
    );
  },[user]);

  /* SAVE */
  const save=async(updated)=>{
    await setDoc(
      doc(db,"users",user.uid),
      {tasks:updated,username},
      {merge:true}
    );
  };

  /* LEADERBOARD */
  useEffect(()=>{
    const load=async()=>{
      const snap=await getDocs(collection(db,"users"));
      const rows=[];

      snap.forEach(docu=>{
        const data=docu.data();
        const tasks=data.tasks||[];

        let weekly=0,monthly=0,yearly=0,allTime=0;

        tasks.forEach(t=>{
          (t.history||[]).forEach(d=>{
            allTime++;
            if(isWithinDays(d,7)) weekly++;
            if(isThisMonth(d)) monthly++;
            if(isThisYear(d)) yearly++;
          });
        });

        rows.push({
          username:data.username||"anon",
          weekly,monthly,yearly,allTime
        });
      });

      setLeaderboard(rows);
    };

    load();
  },[tasks]);

  /* TASK ACTIONS */

  const addTask=()=>{
    if(!newTask.trim()) return;

    save([...tasks,{
      id:Date.now(),
      name:newTask,
      history:[],
      archived:false,
      streak:0,
      longestStreak:0
    }]);

    setNewTask("");
  };

  const renameTask=id=>{
    const name=prompt("New name:");
    if(!name) return;

    save(tasks.map(t=>
      t.id===id?{...t,name}:t
    ));
  };

  const deleteTask=id=>{
    if(!confirm("Delete task?")) return;
    save(tasks.filter(t=>t.id!==id));
  };

  const archiveTask=id=>{
    save(tasks.map(t=>
      t.id===id?{...t,archived:!t.archived}:t
    ));
  };

  /* ANTI-CHEAT MARK */
  const markToday=id=>{
    const t=today();

    const updated=tasks.map(task=>{
      if(task.id!==id) return task;

      if(task.history.includes(t))
        return task;

      const hist=[...task.history,t].sort();

      const last=hist[hist.length-2];
      if(last && daysBetween(t,last)>1)
        alert("Streak broken!");

      let cur=0,longest=0;

      for(let i=0;i<hist.length;i++){
        if(i===0||daysBetween(hist[i],hist[i-1])===1)
          cur++;
        else cur=1;
        longest=Math.max(longest,cur);
      }

      return {...task,
        history:hist,
        streak:cur,
        longestStreak:longest
      };
    });

    save(updated);
  };

  /* LOGIN */
  if(!user)
    return(
      <button onClick={()=>signInWithPopup(auth,provider)}>
        Login with Google
      </button>
    );

  if(loading) return <h2>Loading...</h2>;

  /* USERNAME */
  if(!hasUsername)
    return(
      <div>
        <input
          value={username}
          onChange={e=>setUsername(e.target.value)}
        />
        <button onClick={async()=>{
          await setDoc(
            doc(db,"users",user.uid),
            {username},
            {merge:true}
          );
          setHasUsername(true);
        }}>
          Save Username
        </button>
      </div>
    );

  const active=tasks.filter(t=>!t.archived);
  const archived=tasks.filter(t=>t.archived);

  /* UI */

  return(
    <div style={{padding:20}}>

      <h1>🔥 Streak App</h1>

      <button onClick={()=>signOut(auth)}>Logout</button>
      <button onClick={()=>setPage("calendar")}>Calendar</button>
      <button onClick={()=>setPage("dashboard")}>Dashboard</button>

      {/* CALENDAR PAGE */}
      {page==="calendar"&&(
        <div>

          <input
            value={newTask}
            onChange={e=>setNewTask(e.target.value)}
            placeholder="New task"
          />
          <button onClick={addTask}>Add</button>

          {active.map(task=>{
            const days=getMonthDays();

            return(
              <div key={task.id}
                style={{border:"1px solid #ccc",
                        margin:10,padding:10}}>

                <h3>{task.name}</h3>
                <p>🔥{task.streak} | 🏆{task.longestStreak}</p>

                <button onClick={()=>renameTask(task.id)}>Rename</button>
                <button onClick={()=>archiveTask(task.id)}>Archive</button>
                <button onClick={()=>deleteTask(task.id)}>Delete</button>

                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(7,30px)",
                  gap:5
                }}>
                  {days.map(d=>{
                    const done=task.history.includes(d);
                    return(
                      <div key={d}
                        onClick={()=>markToday(task.id)}
                        style={{
                          width:28,height:28,
                          background:done?"green":"#ddd",
                          color:done?"white":"black",
                          display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          cursor:"pointer"
                        }}>
                        {Number(d.slice(-2))}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}

          <h3>Archived</h3>
          {archived.map(t=>
            <div key={t.id}>
              {t.name}
              <button onClick={()=>archiveTask(t.id)}>
                Unarchive
              </button>
            </div>
          )}

        </div>
      )}

      {/* DASHBOARD */}
      {page==="dashboard"&&(
        <div>
          <h2>🌍 Leaderboards</h2>

          {["weekly","monthly","yearly","allTime"]
            .map(type=>(
              <div key={type}>
                <h3>{type.toUpperCase()}</h3>

                {[...leaderboard]
                  .sort((a,b)=>b[type]-a[type])
                  .slice(0,5)
                  .map((u,i)=>(
                    <div key={i}>
                      {badge(i)} {u.username} — {u[type]}
                    </div>
                  ))}
              </div>
          ))}
        </div>
      )}

    </div>
  );
}
