export type {
  OrdoDetailAdminDiagnosticLink,
  OrdoDetailBadge,
  OrdoDetailFact,
  OrdoDetailLink,
  OrdoDetailLensModel,
  OrdoPersonDetailHeaderModel,
  OrdoDetailTimelineItem,
  OrdoObjectDetailModel,
} from "./ordo-detail-types";

export {
  businessConversationDetailHref,
  businessPersonDetailHref,
  businessReferralDetailHref,
  studioCampaignDetailHref,
  studioContentDetailHref,
  studioMediaDetailHref,
  studioWorkflowDetailHref,
} from "./ordo-detail-routes";

export {
  projectAdminSystemSectionToOrdoDetail,
  projectBusinessConversationToOrdoDetail,
  projectContentCampaignToOrdoDetail,
  projectContentItemToOrdoDetail,
  projectMediaAssetToOrdoDetail,
  projectOfferToOrdoDetail,
  projectPersonToOrdoDetail,
  projectReferralToOrdoDetail,
  projectWorkflowRunToOrdoDetail,
} from "./ordo-detail-projectors";
