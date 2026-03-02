import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import Time "mo:core/Time";
import List "mo:core/List";
import Bool "mo:core/Bool";
import Nat32 "mo:core/Nat32";

import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";

actor {
  type Exam = {
    id : Text;
    title : Text;
    subject : Text;
    dateTime : Int;
    location : Text;
    examType : Text;
    completed : Bool;
    progress : Nat;
  };

  module Exam {
    public func compare(exam1 : Exam, exam2 : Exam) : Order.Order {
      switch (Int.compare(exam1.dateTime, exam2.dateTime)) {
        case (#equal) { Text.compare(exam1.title, exam2.title) };
        case (order) { order };
      };
    };
  };

  type Topic = {
    id : Text;
    name : Text;
    completed : Bool;
    order : Nat;
    references : [Text];
    notes : ?Text;
  };

  type Chapter = {
    id : Text;
    name : Text;
    topics : [Topic];
  };

  type Subject = {
    id : Text;
    name : Text;
    chapters : [Chapter];
  };

  type Folder = {
    id : Text;
    name : Text;
    parentId : ?Text;
  };

  type Note = {
    id : Text;
    title : Text;
    content : Text;
    tags : [Text];
    pinned : Bool;
    favorite : Bool;
    blob : ?Storage.ExternalBlob;
    createdAt : Int;
    folderId : Text;
  };

  let exams = Map.empty<Text, Exam>();
  let subjects = Map.empty<Text, Subject>();
  let folders = Map.empty<Text, Folder>();
  let notes = Map.empty<Text, Note>();

  include MixinStorage();

  public shared ({ caller }) func createExam(exam : Exam) : async () {
    exams.add(exam.id, exam);
  };

  public shared ({ caller }) func updateExam(exam : Exam) : async () {
    switch (exams.get(exam.id)) {
      case (null) { Runtime.trap("Exam not found") };
      case (?_) {
        exams.add(exam.id, exam);
      };
    };
  };

  public shared ({ caller }) func deleteExam(id : Text) : async () {
    switch (exams.get(id)) {
      case (null) { Runtime.trap("Exam not found") };
      case (?_) {
        exams.remove(id);
      };
    };
  };

  public query ({ caller }) func getExamsBySubject(subject : Text) : async [Exam] {
    exams.values().toArray().filter(func(e) { e.subject == subject });
  };

  public query ({ caller }) func getUpcomingExams() : async [Exam] {
    let now = Time.now();
    exams.values().toArray().filter(func(e) { e.dateTime > now }).sort();
  };

  public shared ({ caller }) func createSubject(subject : Subject) : async () {
    subjects.add(subject.id, subject);
  };

  public shared ({ caller }) func updateSubject(subject : Subject) : async () {
    switch (subjects.get(subject.id)) {
      case (null) { Runtime.trap("Subject not found") };
      case (?_) {
        subjects.add(subject.id, subject);
      };
    };
  };

  public shared ({ caller }) func deleteSubject(id : Text) : async () {
    switch (subjects.get(id)) {
      case (null) { Runtime.trap("Subject not found") };
      case (?_) {
        subjects.remove(id);
      };
    };
  };

  public query ({ caller }) func searchSyllabus(term : Text) : async [Text] {
    let results = List.empty<Text>();
    for (subject in subjects.values()) {
      if (subject.name.contains(#text term)) {
        results.add(subject.name);
      };
      for (chapter in subject.chapters.values()) {
        if (chapter.name.contains(#text term)) {
          results.add(chapter.name);
        };
        for (topic in chapter.topics.values()) {
          if (topic.name.contains(#text term)) {
            results.add(topic.name);
          };
        };
      };
    };
    results.toArray();
  };

  public shared ({ caller }) func createFolder(folder : Folder) : async () {
    folders.add(folder.id, folder);
  };

  public shared ({ caller }) func updateFolder(folder : Folder) : async () {
    switch (folders.get(folder.id)) {
      case (null) { Runtime.trap("Folder not found") };
      case (?_) {
        folders.add(folder.id, folder);
      };
    };
  };

  public shared ({ caller }) func deleteFolder(id : Text) : async () {
    switch (folders.get(id)) {
      case (null) { Runtime.trap("Folder not found") };
      case (?_) {
        folders.remove(id);
      };
    };
  };

  public shared ({ caller }) func createNote(note : Note) : async () {
    notes.add(note.id, note);
  };

  public shared ({ caller }) func updateNote(note : Note) : async () {
    switch (notes.get(note.id)) {
      case (null) { Runtime.trap("Note not found") };
      case (?_) {
        notes.add(note.id, note);
      };
    };
  };

  public shared ({ caller }) func deleteNote(id : Text) : async () {
    switch (notes.get(id)) {
      case (null) { Runtime.trap("Note not found") };
      case (?_) {
        notes.remove(id);
      };
    };
  };

  public query ({ caller }) func searchNotes(term : Text) : async [Note] {
    notes.values().toArray().filter(
      func(n) {
        n.title.contains(#text term) or n.content.contains(#text term);
      }
    );
  };

  public query ({ caller }) func getPinnedNotes() : async [Note] {
    notes.values().toArray().filter(func(n) { n.pinned });
  };

  public query ({ caller }) func getFavoriteNotes() : async [Note] {
    notes.values().toArray().filter(func(n) { n.favorite });
  };
};
