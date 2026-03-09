import React, { useEffect, useState } from "react";

export default function LiveDataPanel() {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const i = setInterval(() => {
      setValue(Math.round(Math.random() * 1000));
    }, 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="livePanel">
      <h3>Live Data</h3>
      <div>{value}</div>
    </div>
  );
}