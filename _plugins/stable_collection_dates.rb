# frozen_string_literal: true

# Jekyll assigns build time to collection documents without a `date` in front matter.
# jekyll-seo-tag then emits article:published_time / article:modified_time on every
# build, causing noisy diffs in _site. Only blog posts should get automatic dates.

module Jekyll
  class Document
    alias_method :jekyll_original_date, :date

    def date
      if collection && collection.label != "posts" && !explicit_document_date?
        return data["date"]
      end

      jekyll_original_date
    end

    def explicit_document_date?
      return @explicit_document_date if defined?(@explicit_document_date)

      source = File.read(path, :encoding => "UTF-8")
      return @explicit_document_date = false unless source =~ YAML_FRONT_MATTER_REGEXP

      @explicit_document_date = Regexp.last_match(1).match?(/^date\s*:/m)
    end
  end

  Jekyll::Hooks.register :documents, :pre_render do |doc|
    next if doc.collection&.label == "posts"
    next if doc.explicit_document_date?

    doc.data.delete("date")
  end
end
