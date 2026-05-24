import React from "react";

interface HelloProps {
  name: string;
}

export default function Hello({ name }: HelloProps) {
  return <h2 className="mdv-hello">Hello, {name}!</h2>;
}
