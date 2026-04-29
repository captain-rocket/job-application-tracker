import type { SubmitEvent } from "react";
import { toDateInputValue } from "../utils/applicationDate";
import { Application, ApplicationStatus } from "../types/api";
import styles from "./ApplicationsPage.module.css";

export type EditFormState = {
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  appliedAt: string;
};

type ApplicationListItemProps = {
  application: Application;
  isEditing: boolean;
  editForm: EditFormState | null;
  isSaving: boolean;
  updateError: string | null;
  statusOptions: ApplicationStatus[];
  onStartEdit: (application: Application) => void;
  onCancelEdit: () => void;
  onSubmit: (
    event: SubmitEvent<HTMLFormElement>,
    applicationId: number,
  ) => Promise<void>;
  onEditFormChange: (updates: Partial<EditFormState>) => void;
};

export function ApplicationListItem({
  application,
  isEditing,
  editForm,
  isSaving,
  updateError,
  statusOptions,
  onStartEdit,
  onCancelEdit,
  onSubmit,
  onEditFormChange,
}: ApplicationListItemProps) {
  return (
    <li className={`surfacePanel ${styles.applicationItem}`}>
      <div className={styles.applicationItemHeader}>
        <h2>{application.company}</h2>
        {isEditing ? null : (
          <button
            type="button"
            className="secondaryButton"
            onClick={() => onStartEdit(application)}
            disabled={isSaving}
          >
            Edit
          </button>
        )}
      </div>

      {isEditing && editForm ? (
        <form
          className={styles.editForm}
          onSubmit={(event) => {
            void onSubmit(event, application.id);
          }}
        >
          {updateError ? (
            <p role="alert" className="errorMessage">
              {updateError}
            </p>
          ) : null}

          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label htmlFor={`edit-company-${application.id}`}>Company</label>
              <input
                type="text"
                className={styles.formControl}
                id={`edit-company-${application.id}`}
                value={editForm.company}
                onChange={(event) =>
                  onEditFormChange({ company: event.target.value })
                }
                disabled={isSaving}
                required
              />
            </div>

            <div className={styles.formRow}>
              <label htmlFor={`edit-jobTitle-${application.id}`}>
                Job Title
              </label>
              <input
                type="text"
                className={styles.formControl}
                id={`edit-jobTitle-${application.id}`}
                value={editForm.jobTitle}
                onChange={(event) =>
                  onEditFormChange({ jobTitle: event.target.value })
                }
                disabled={isSaving}
                required
              />
            </div>

            <div className={styles.formRow}>
              <label htmlFor={`edit-status-${application.id}`}>Status</label>
              <select
                className={styles.formControl}
                id={`edit-status-${application.id}`}
                value={editForm.status}
                onChange={(event) =>
                  onEditFormChange({
                    status: event.target.value as ApplicationStatus,
                  })
                }
                disabled={isSaving}
                required
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label htmlFor={`edit-appliedAt-${application.id}`}>
                Applied at
              </label>
              <input
                type="date"
                className={styles.formControl}
                id={`edit-appliedAt-${application.id}`}
                value={editForm.appliedAt}
                onChange={(event) =>
                  onEditFormChange({ appliedAt: event.target.value })
                }
                disabled={isSaving}
              />
            </div>
          </div>
          <div className={styles.editActions}>
            <button
              type="submit"
              className={`primaryButton ${styles.submitButton}`}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="secondaryButton"
              onClick={onCancelEdit}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className={styles.applicationDetails}>
          <div>
            <dt>Job Title</dt>
            <dd>{application.job_title}</dd>
          </div>

          <div>
            <dt>Status</dt>
            <dd>{application.status}</dd>
          </div>
          <div>
            <dt>Applied At</dt>
            <dd>
              {application.applied_at
                ? toDateInputValue(application.applied_at)
                : "Not set"}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}
