ALTER TABLE campaigns ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE extranet_campaign_proposals(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),actor_id TEXT NOT NULL,revision INTEGER NOT NULL,old_json TEXT NOT NULL,new_json TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('pending','approved')),approved_by TEXT,created_at TEXT NOT NULL);
CREATE TRIGGER extranet_campaign_review BEFORE UPDATE OF status ON extranet_campaign_proposals BEGIN
 SELECT CASE WHEN OLD.status!='pending' OR NEW.status!='approved' OR (SELECT revision FROM campaigns WHERE id=OLD.campaign_id)!=OLD.revision THEN RAISE(ABORT,'stale campaign approval') END;
END;
CREATE TRIGGER extranet_campaign_apply AFTER UPDATE OF status ON extranet_campaign_proposals WHEN NEW.status='approved' BEGIN
 UPDATE campaigns SET percent_bps=json_extract(NEW.new_json,'$.percent_bps'),valid_days=json_extract(NEW.new_json,'$.valid_days'),active=json_extract(NEW.new_json,'$.active'),revision=revision+1 WHERE id=NEW.campaign_id;
END;
CREATE TRIGGER coupon_rate_immutable BEFORE UPDATE OF percent_bps ON coupons WHEN NEW.percent_bps!=OLD.percent_bps BEGIN SELECT RAISE(ABORT,'issued coupon rate is immutable'); END;
