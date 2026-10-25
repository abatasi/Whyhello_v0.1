import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyManagementLevel,
  MANAGEMENT_LEVELS,
  normalizeManagementLevel,
} from "./contact-management-levels.js";

test("management level filters use the requested labels and order", () => {
  assert.deepEqual(MANAGEMENT_LEVELS, [
    "Owner",
    "Founder",
    "C suite",
    "Partner",
    "Vp",
    "Head",
    "Director",
    "Manager",
    "Senior",
    "Entry",
    "Intern",
  ]);
});

test("management levels can be inferred from saved seniority and job titles", () => {
  assert.equal(classifyManagementLevel("C-Suite", "Chief Financial Officer"), "C suite");
  assert.equal(classifyManagementLevel(null, "Co-Founder and CEO"), "Founder");
  assert.equal(classifyManagementLevel(null, "Vice President of Sales"), "Vp");
  assert.equal(classifyManagementLevel(null, "Head of Product"), "Head");
  assert.equal(classifyManagementLevel("Director", "Director of Operations"), "Director");
  assert.equal(classifyManagementLevel(null, "Marketing Manager"), "Manager");
  assert.equal(classifyManagementLevel("Individual Contributor", "Senior Engineer"), "Senior");
  assert.equal(classifyManagementLevel(null, "Summer Intern"), "Intern");
  assert.equal(classifyManagementLevel(null, "Junior Analyst"), "Entry");
  assert.equal(classifyManagementLevel(null, "Account Executive"), null);
});

test("overlapping titles resolve to one primary management level", () => {
  assert.equal(classifyManagementLevel(null, "Founder and CEO"), "Founder");
  assert.equal(classifyManagementLevel("Manager", "Senior Product Manager"), "Manager");
});

test("legacy saved-search levels normalize to the new filter labels", () => {
  assert.equal(normalizeManagementLevel("C-Suite"), "C suite");
  assert.equal(normalizeManagementLevel("VP"), "Vp");
  assert.equal(normalizeManagementLevel("Individual Contributor"), "Senior");
  assert.equal(normalizeManagementLevel("Director"), "Director");
});
