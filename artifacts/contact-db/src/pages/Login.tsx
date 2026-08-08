import { Redirect } from "wouter";

// Redirects legacy /login path to the Clerk sign-in page.
export default function Login() {
  return <Redirect to="/sign-in" />;
}
