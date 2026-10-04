import { LayoutTemplate, PencilRuler } from "lucide-react";
import { PlaybookDialog } from "./PlaybookDialog";

export function PlaybookCreationChoice({ onScratch, onTemplate, onClose }: {
  onScratch: () => void; onTemplate: () => void; onClose: () => void;
}) {
  return <PlaybookDialog
    title="Create playbook"
    description="How would you like to build your playbook?"
    onClose={onClose}
  >
    <div className="pb-creation-choices">
      <button type="button" className="pb-creation-choice" onClick={onScratch}>
        <span className="pb-creation-choice-icon"><PencilRuler size={48} strokeWidth={1.5} aria-hidden="true" /></span>
        <span className="pb-creation-choice-title">Build from scratch</span>
        <span className="pb-creation-choice-description">Start with a blank canvas and build your own outreach workflow.</span>
      </button>
      <button type="button" className="pb-creation-choice" onClick={onTemplate}>
        <span className="pb-creation-choice-icon"><LayoutTemplate size={48} strokeWidth={1.5} aria-hidden="true" /></span>
        <span className="pb-creation-choice-title">Use a template</span>
        <span className="pb-creation-choice-description">Choose a ready-made playbook and customize it to fit your outreach.</span>
      </button>
    </div>
  </PlaybookDialog>;
}