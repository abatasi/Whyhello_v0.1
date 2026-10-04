import { strict as assert } from "node:assert";
import { test } from "node:test";
import { callAudioText } from "./call-audio-text";

const script = { opener: " Hello, Alex. ", talkingPoints: ["One relevant observation.", "", "Another point."],
  questions: ["What is your perspective?"], objections: [{ objection: "Not now.", response: "Another time is fine." }],
  closing: "Thanks for your time.", voicemail: "Please call back when convenient." };
test("conversation reads only actual seller lines in script order, with paragraph pauses", () => {
  assert.equal(callAudioText(script, "conversation"), "Hello, Alex.\n\nOne relevant observation.\n\nAnother point.\n\nWhat is your perspective?\n\nThanks for your time.");
  assert.ok(!callAudioText(script, "conversation").includes("Not now"));
});
test("opener and voicemail are separate actual-text recordings", () => {
  assert.equal(callAudioText(script, "opener"), "Hello, Alex.");
  assert.equal(callAudioText(script, "voicemail"), script.voicemail);
});
test("editing the script changes exactly the next spoken input; blank messages remain empty", () => {
  assert.equal(callAudioText({ ...script, voicemail: "" }, "voicemail"), "");
  assert.equal(callAudioText({ ...script, opener: "Updated greeting." }, "opener"), "Updated greeting.");
});